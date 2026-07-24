"""推广拉新 / 钱包 业务逻辑层。

职责：
  - 读取 PromoConfig 配置（带类型转换）
  - 生成推广码、专属链接
  - 访客去重 key、真实 IP 提取
  - 发奖 + 阶梯奖励判定

main.py 只做路由薄壳，业务规则集中在这里。
"""
import hashlib
import secrets
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sqlOrm import User, ReferralEvent, PromoConfig, PROMO_CONFIG_DEFAULTS

# 永久会员用一个远期日期表示（仅记录，应用当前无会员门槛）
PERMANENT_MEMBERSHIP_DATE = datetime(2099, 12, 31)


# ---------------- 配置读取 ----------------
def get_config_map(db: Session) -> dict:
    """返回完整配置字典（缺失的 key 用默认值补齐，避免脏库导致 KeyError）。"""
    cfg = dict(PROMO_CONFIG_DEFAULTS)
    for row in db.query(PromoConfig).all():
        if row.value is not None:
            cfg[row.key] = row.value
    return cfg


def _to_int(value, default: int) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _to_float(value, default: float) -> float:
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return default


def _is_on(value) -> bool:
    return str(value).strip() in ("1", "true", "True", "yes", "on")


# ---------------- IP / 去重 ----------------
def client_ip(request) -> str:
    """优先取反向代理透传的真实 IP（宝塔/Nginx 部署常见）。"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def make_visitor_key(fingerprint: str, ip: str) -> str:
    """浏览器指纹 + IP 双重识别，sha256 后作为全局唯一去重键。"""
    raw = f"{(fingerprint or '').strip()}|{(ip or '').strip()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ---------------- 推广码 / 链接 ----------------
def generate_referral_code(db: Session) -> str:
    """生成不与现有冲突的 8 位推广码。"""
    for _ in range(20):
        code = secrets.token_urlsafe(6)[:8]
        if not db.query(User.id).filter(User.referral_code == code).first():
            return code
    # 极端兜底：加随机后缀
    return (secrets.token_urlsafe(8))[:12]


def get_or_create_referral_code(db: Session, user: User) -> str:
    if not user.referral_code:
        user.referral_code = generate_referral_code(db)
        db.commit()
    return user.referral_code


def build_referral_link(db: Session, code: str) -> str:
    cfg = get_config_map(db)
    base = cfg.get("landing_base_url") or PROMO_CONFIG_DEFAULTS["landing_base_url"]
    sep = "&" if "?" in base else "?"
    return f"{base}{sep}ref={code}"


# ---------------- 发奖 ----------------
class TrackResult:
    def __init__(self, ok: bool, awarded: bool, reason: str = "", amount: float = 0.0,
                 tier_awarded: bool = False):
        self.ok = ok
        self.awarded = awarded          # 本次是否真正发放了基础奖励
        self.reason = reason
        self.amount = amount
        self.tier_awarded = tier_awarded

    def to_dict(self):
        return {
            "ok": self.ok,
            "awarded": self.awarded,
            "reason": self.reason,
            "amount": self.amount,
            "tier_awarded": self.tier_awarded,
        }


def track_download(db: Session, ref_code: str, fingerprint: str, ip: str,
                   visitor_user_id=None) -> TrackResult:
    """访客点击下载控件时调用：校验并给推广人发奖。

    返回 TrackResult。已计过 / 无效推广人 / 自推 都返回 ok=True 但 awarded=False，
    因为下载动作本身不应因此失败。
    """
    if not ref_code:
        return TrackResult(ok=True, awarded=False, reason="no_ref")

    referrer = db.query(User).filter(User.referral_code == ref_code).first()
    if not referrer:
        return TrackResult(ok=True, awarded=False, reason="invalid_ref")

    # 防自推：访客本人若已登录且就是推广人
    if visitor_user_id is not None and visitor_user_id == referrer.id:
        return TrackResult(ok=True, awarded=False, reason="self_referral")

    cfg = get_config_map(db)
    reward_base = _to_float(cfg.get("reward_base"), 3.0)
    tier_threshold = _to_int(cfg.get("tier_threshold"), 5)
    tier_bonus = _to_float(cfg.get("tier_bonus"), 20.0)
    tier_days = _to_int(cfg.get("tier_membership_days"), -1)

    visitor_key = make_visitor_key(fingerprint, ip)

    # 已存在（同一访客）→ 直接返回，不重复发奖
    if db.query(ReferralEvent.id).filter(ReferralEvent.visitor_key == visitor_key).first():
        # return TrackResult(ok=True, awarded=False, reason="already_counted")
        pass

    event = ReferralEvent(
        referrer_id=referrer.id,
        visitor_key=visitor_key,
        visitor_ip=ip,
        visitor_fingerprint=fingerprint,
        reward_amount=reward_base,
    )
    db.add(event)
    try:
        db.flush()  # 触发唯一约束校验（并发下兜底）
    except IntegrityError:
        db.rollback()
        return TrackResult(ok=True, awarded=False, reason="already_counted")

    # 发放基础奖励
    referrer.balance_usd = (referrer.balance_usd or 0.0) + reward_base
    referrer.referral_count = (referrer.referral_count or 0) + 1

    # 阶梯奖励：恰好跨过阈值的整数倍时发放（首次达 5、10…）
    tier_awarded = False
    if tier_threshold > 0 and referrer.referral_count % tier_threshold == 0:
        referrer.balance_usd += tier_bonus
        tier_awarded = True
        if tier_days == -1:
            referrer.membership_expire_at = PERMANENT_MEMBERSHIP_DATE
        elif tier_days > 0:
            base_time = referrer.membership_expire_at
            if not base_time or base_time < datetime.now():
                base_time = datetime.now()
            referrer.membership_expire_at = base_time + timedelta(days=tier_days)

    db.commit()
    return TrackResult(ok=True, awarded=True, reason="awarded",
                       amount=reward_base, tier_awarded=tier_awarded)
