from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.security import create_access_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserResponse
from app.services.auth import (
    UserAlreadyExistsError,
    authenticate_user,
    create_user,
)


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_AUTHENTICATION_RESPONSES = {
    401: {"description": "Missing, invalid, or expired bearer credentials."}
}
_INVALID_LOGIN_RESPONSES = {
    401: {"description": "The username or password is incorrect."}
}
_CONFLICT_RESPONSES = {
    409: {"description": "A user with this username or email already exists."}
}


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    responses=_CONFLICT_RESPONSES,
)
def register_user(
    user_data: UserCreate,
    db: Annotated[Session, Depends(get_db)],
) -> UserResponse:
    try:
        return create_user(db, user_data)
    except UserAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already exists",
        ) from None


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    responses=_INVALID_LOGIN_RESPONSES,
)
def login_user(
    login_data: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    user = authenticate_user(db, login_data.username, login_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        {"sub": str(user.id), "username": user.username}
    )
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    description="Returns the authenticated user's profile.",
    responses=_AUTHENTICATION_RESPONSES,
)
def get_current_user_info(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    return current_user