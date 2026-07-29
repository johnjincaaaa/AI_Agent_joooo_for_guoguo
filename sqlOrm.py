from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey,JSON,BIGINT,Float,UniqueConstraint, inspect, text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
from config import SQLALCHEMY_DATABASE_URL

# SQLite 需要关闭线程检查（FastAPI 多线程访问同一连接）；其它数据库正常连接。
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
# ======================
# 用户表
# ======================
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)  # 账号唯一
    password = Column(String(255), nullable=False)  # bcrypt 哈希
    register_time = Column(DateTime, default=datetime.now)

    # ===== 推广拉新相关 =====
    referral_code = Column(String(16), unique=True, index=True, nullable=True)  # 专属推广码（首次取链接时生成）
    balance_usd = Column(Float, default=0.0, nullable=False)                    # 推广美金余额（不含待审核提现）
    referral_count = Column(Integer, default=0, nullable=False)                 # 累计有效推广人数
    membership_expire_at = Column(DateTime, nullable=True)                      # 会员到期（永久=远期日期，仅记录）

    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete") # 意思：双向绑定，两边能互相找到对方session.user

# ======================
# 会话表
# ======================
class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    session_name = Column(String(100),nullable=False)  # 加上会话名字段
    session_time = Column(BIGINT,nullable=False,comment="创建时间（ms时间戳）")
    messages = Column(JSON)  # 对话JSON
    # 👇 核心：user_id + session_time 联合唯一索引（同一会话不重复）
    __table_args__ = (
        UniqueConstraint("user_id", "session_time", name="uq_user_session_time"),
    )
    user = relationship("User", back_populates="sessions")


class JobProfile(Base):
    __tablename__ = "job_profiles"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    profile_data = Column(JSON, default=dict)
    resume_content = Column(Text, nullable=True)
    template_id = Column(String(50), default="classic")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    user = relationship("User")


# ======================
# 有效推广记录表
# ======================
class ReferralEvent(Base):
    __tablename__ = "referral_events"

    id = Column(Integer, primary_key=True, index=True)
    referrer_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)  # 推广人
    # sha256(fingerprint|ip)，全局唯一 → 同一访客只计一次
    visitor_key = Column(String(64), unique=True, index=True, nullable=False)
    visitor_ip = Column(String(64), nullable=True)
    visitor_fingerprint = Column(String(128), nullable=True)
    reward_amount = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.now)


# ======================
# 提现申请表
# ======================
class WithdrawRequest(Base):
    __tablename__ = "withdraw_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    amount = Column(Float, nullable=False)
    paypal_email = Column(String(120), nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # pending / paid / rejected
    created_at = Column(DateTime, default=datetime.now)
    reviewed_at = Column(DateTime, nullable=True)


# ======================
# 推广可视化配置表（key-value）
# ======================
class PromoConfig(Base):
    __tablename__ = "promo_config"

    key = Column(String(64), primary_key=True)
    value = Column(Text, nullable=True)


# 配置默认值（seed 时仅补齐缺失的 key，不覆盖已有值）
PROMO_CONFIG_DEFAULTS = {
    # 分享弹窗介绍文案
    "popup_intro_zh": "把你的专属链接分享给好友，好友进入网页并点击下载APP，你即可获得美金奖励！",
    "popup_intro_en": "Share your personal link. When a friend opens the page and taps Download App, you earn USD rewards!",
    # 输入框推广文案
    "input_promo_zh": "邀请好友下载APP，每人奖励3美金，满5人再得20美金+永久会员！",
    "input_promo_en": "Invite friends to download the App: $3 each, plus $20 + lifetime membership at 5 invites!",
    # 空状态横幅文案（默认用用户给的推广词）
    "banner_promo_zh": "Rove AI 重磅福利\n📥下载APP ➜ 2美金 + 30天会员\n👥邀1人 = 3美金\n👥邀5人 = 20美金 + 永久会员\n智能AI对话工具，收益轻松拿！",
    "banner_promo_en": "Rove AI Bonus\n📥 Download App ➜ $2 + 30-day membership\n👥 Invite 1 = $3\n👥 Invite 5 = $20 + lifetime membership\nSmart AI chat, earn with ease!",
    # 奖励规则
    "reward_base": "3",
    "tier_threshold": "5",
    "tier_bonus": "20",
    "tier_membership_days": "-1",   # -1 表示永久
    # 开关
    "promo_enabled": "1",
    "input_promo_enabled": "1",
    # 推广链接缓存有效期（天）
    "link_cache_days": "30",
    # 专属链接跳转的网页地址（前端拼 ?ref=）
    "landing_base_url": "http://gtp88.top/chat",

}


def _ensure_user_columns():
    """SQLite/MySQL 下 create_all 不会给已存在的 users 表补列，这里幂等补齐推广字段。"""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("users")}
    # 列名 -> 建列 DDL（SQLite 与 MySQL 通用的简单类型）
    add_cols = {
        "referral_code": "VARCHAR(16)",
        "balance_usd": "FLOAT NOT NULL DEFAULT 0",
        "referral_count": "INTEGER NOT NULL DEFAULT 0",
        "membership_expire_at": "DATETIME NULL",
    }
    with engine.begin() as conn:
        for col, ddl in add_cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {col} {ddl}"))


def seed_promo_config():
    """补齐缺失的推广配置默认值（不覆盖已有值）。"""
    db = SessionLocal()
    try:
        existing = {row.key for row in db.query(PromoConfig.key).all()}
        for key, value in PROMO_CONFIG_DEFAULTS.items():
            if key not in existing:
                db.add(PromoConfig(key=key, value=value))
        db.commit()
    finally:
        db.close()


# 自动创建所有表（不用写SQL）
Base.metadata.create_all(bind=engine)
# 给旧库补列 + 补齐配置默认值
_ensure_user_columns()
seed_promo_config()

# DB 依赖  给你的接口【自动提供数据库连接】，用完【自动关闭】
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == '__main__':
    # 手动初始化数据库（创建 app.db 及所有表）
    Base.metadata.create_all(bind=engine)
    print("数据库初始化完成：", SQLALCHEMY_DATABASE_URL)