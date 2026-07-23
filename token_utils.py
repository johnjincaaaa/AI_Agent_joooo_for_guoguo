from typing import Optional

from fastapi import HTTPException, status, Depends
from jose import JWTError, jwt
from datetime import datetime, timedelta, UTC
from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
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
