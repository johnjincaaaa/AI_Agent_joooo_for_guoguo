import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, stored: str) -> bool:
    if stored.startswith("$2"):
        return bcrypt.checkpw(plain.encode(), stored.encode())
    return plain == stored


def needs_rehash(stored: str) -> bool:
    return not stored.startswith("$2")
