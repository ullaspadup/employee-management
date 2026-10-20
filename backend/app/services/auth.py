from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate


class UserAlreadyExistsError(Exception):
    pass


def create_user(db: Session, user_data: UserCreate) -> User:
    existing_username = db.scalar(
        select(User.id).where(User.username == user_data.username)
    )
    if existing_username is not None:
        raise UserAlreadyExistsError("Username already exists")

    existing_email = db.scalar(select(User.id).where(User.email == user_data.email))
    if existing_email is not None:
        raise UserAlreadyExistsError("Email already exists")

    user = User(
        username=user_data.username,
        email=user_data.email,
        password_hash=hash_password(user_data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user