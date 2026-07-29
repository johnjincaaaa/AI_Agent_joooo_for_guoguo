from typing import Optional

from fastapi import HTTPException, status, Depends
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# datetime.UTC 是 Python 3.11+ 才有的别名；用 timezone.utc 兼容 3.10 及以下
UTC = timezone.utc
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_user_id(token: str) -> int:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    user_id = payload.get("user_id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 token",
        )
    return int(user_id)


def verify_token(token: str = Depends(oauth2_scheme)) -> int:
    try:
        return decode_user_id(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "msg": "token 验证失败"},
        )


def get_optional_user_id(token: Optional[str] = Depends(oauth2_scheme_optional)) -> Optional[int]:
    if not token:
        return None
    try:
        return decode_user_id(token)
    except (JWTError, HTTPException):
        return None


# ===================== 后台管理员 token =====================
# 独立的管理员令牌：payload 带 role=admin，复用同一 SECRET_KEY/算法。
# 有效期较长（默认 12 小时），后台前端存 sessionStorage。
ADMIN_TOKEN_EXPIRE_MINUTES = 12 * 60

# 用独立的 Bearer 方案，避免和普通用户登录冲突
admin_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="admin/api/login", auto_error=False)


def create_admin_token() -> str:
    expire = datetime.now(UTC) + timedelta(minutes=ADMIN_TOKEN_EXPIRE_MINUTES)
    to_encode = {"role": "admin", "exp": expire}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_admin_token(token: Optional[str] = Depends(admin_oauth2_scheme)) -> bool:
    """校验管理员令牌：签名有效且 role==admin。失败一律 401。"""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "msg": "未登录后台"},
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "msg": "后台令牌无效或已过期"},
        )
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": 401, "msg": "无后台权限"},
        )
    return True
