from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey,JSON,BIGINT,UniqueConstraint
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

# 自动创建所有表（不用写SQL）
Base.metadata.create_all(bind=engine)

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