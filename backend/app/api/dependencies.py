from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User


security = HTTPBearer()


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.InvalidTokenError:
        raise _credentials_exception() from None

    subject = payload.get("sub")
    if isinstance(subject, bool):
        raise _credentials_exception()
    if isinstance(subject, int):
        user_id = subject
    elif isinstance(subject, str) and subject.isascii() and subject.isdecimal():
        user_id = int(subject)
    else:
        raise _credentials_exception()

    if user_id <= 0:
        raise _credentials_exception()

    user = db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise _credentials_exception()
    return user