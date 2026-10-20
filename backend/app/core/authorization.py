from typing import Annotated, Callable

from fastapi import Depends, HTTPException, status

from app.api.dependencies import get_current_user
from app.core.roles import UserRole
from app.models.user import User


def require_roles(*allowed_roles: UserRole) -> Callable[..., User]:
    def role_checker(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return role_checker