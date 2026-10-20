from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.authorization import require_roles
from app.core.roles import UserRole
from app.db.session import get_db
from app.models.user import User
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeResponse,
    EmployeeUpdate,
)
from app.services.employee import (
    EmployeeStatus,
    create_employee,
    delete_employee,
    get_employee,
    get_employees,
    reactivate_employee,
    search_employees,
    update_employee,
)


router = APIRouter(prefix="/api/v1/employees", tags=["employees"])

_AUTHENTICATION_RESPONSES = {
    401: {"description": "Missing, invalid, or expired bearer credentials."}
}
_AUTHORIZATION_RESPONSES = {
    403: {"description": "The authenticated user lacks the required role."}
}
_BAD_REQUEST_RESPONSES = {
    400: {"description": "A supplied sorting value is unsupported."}
}
_NOT_FOUND_RESPONSES = {
    404: {"description": "No employee exists with the supplied ID."}
}
_CONFLICT_RESPONSES = {
    409: {"description": "An employee with this code or email already exists."}
}


@router.post(
    "",
    response_model=EmployeeResponse,
    status_code=status.HTTP_201_CREATED,
    description="Creates an employee. Requires the ADMIN or HR role.",
    responses={
        **_AUTHENTICATION_RESPONSES,
        **_AUTHORIZATION_RESPONSES,
        **_CONFLICT_RESPONSES,
    },
)
def create_employee_endpoint(
    employee_data: EmployeeCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User, Depends(require_roles(UserRole.ADMIN, UserRole.HR))
    ],
) -> EmployeeResponse:
    try:
        return create_employee(db, employee_data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee code or email already exists",
        ) from None


@router.get(
    "",
    response_model=EmployeeListResponse,
    status_code=status.HTTP_200_OK,
    description="Lists employees by lifecycle status. The status defaults to active. Requires an authenticated user.",
    responses={**_AUTHENTICATION_RESPONSES, **_BAD_REQUEST_RESPONSES},
)
def list_employees(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    skip: Annotated[int, Query(ge=0, description="Number of matching employees to skip.")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Maximum number of employees to return.")] = 100,
    department: Annotated[str | None, Query(description="Filter by exact department name, case-insensitively.")] = None,
    designation: Annotated[str | None, Query(description="Filter by exact designation, case-insensitively.")] = None,
    sort_by: Annotated[str, Query(description="Employee field used to sort results; unsupported values return HTTP 400.")] = "id",
    sort_order: Annotated[str, Query(description="Sort direction; unsupported values return HTTP 400.")] = "asc",
    employee_status: Annotated[
        EmployeeStatus,
        Query(
            alias="status",
            description="Lifecycle status to include: active, inactive, or all. Defaults to active.",
        ),
    ] = "active",
) -> EmployeeListResponse:
    try:
        employees, total = get_employees(
            db,
            skip=skip,
            limit=limit,
            department=department,
            designation=designation,
            sort_by=sort_by,
            sort_order=sort_order,
            employee_status=employee_status,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    return EmployeeListResponse(
        items=employees,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/search",
    response_model=EmployeeListResponse,
    status_code=status.HTTP_200_OK,
    description="Searches employees by lifecycle status. The status defaults to active. Requires an authenticated user.",
    responses={**_AUTHENTICATION_RESPONSES, **_BAD_REQUEST_RESPONSES},
)
def find_employees(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    search: Annotated[str, Query(min_length=1, description="Case-insensitive partial match across employee code, names, email, department, and designation.")],
    skip: Annotated[int, Query(ge=0, description="Number of matching employees to skip.")] = 0,
    limit: Annotated[int, Query(ge=1, le=100, description="Maximum number of matching employees to return.")] = 100,
    sort_by: Annotated[str, Query(description="Employee field used to sort results; unsupported values return HTTP 400.")] = "id",
    sort_order: Annotated[str, Query(description="Sort direction; unsupported values return HTTP 400.")] = "asc",
    employee_status: Annotated[
        EmployeeStatus,
        Query(
            alias="status",
            description="Lifecycle status to include: active, inactive, or all. Defaults to active.",
        ),
    ] = "active",
) -> EmployeeListResponse:
    try:
        employees, total = search_employees(
            db,
            search=search,
            skip=skip,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,
            employee_status=employee_status,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    return EmployeeListResponse(
        items=employees,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{employee_id}",
    response_model=EmployeeResponse,
    status_code=status.HTTP_200_OK,
    description="Returns an employee to any authenticated user.",
    responses={**_AUTHENTICATION_RESPONSES, **_NOT_FOUND_RESPONSES},
)
def read_employee(
    employee_id: Annotated[int, Path(gt=0, description="Positive employee ID.")],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmployeeResponse:
    employee = get_employee(db, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


@router.patch(
    "/{employee_id}/activate",
    response_model=EmployeeResponse,
    status_code=status.HTTP_200_OK,
    description="Reactivates an employee. Requires the ADMIN or HR role.",
    responses={
        **_AUTHENTICATION_RESPONSES,
        **_AUTHORIZATION_RESPONSES,
        **_NOT_FOUND_RESPONSES,
    },
)
def activate_employee(
    employee_id: Annotated[int, Path(gt=0, description="Positive employee ID.")],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User, Depends(require_roles(UserRole.ADMIN, UserRole.HR))
    ],
) -> EmployeeResponse:
    if not reactivate_employee(db, employee_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )

    employee = get_employee(db, employee_id)
    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


@router.patch(
    "/{employee_id}",
    response_model=EmployeeResponse,
    status_code=status.HTTP_200_OK,
    description="Updates an employee. Requires the ADMIN or HR role.",
    responses={
        **_AUTHENTICATION_RESPONSES,
        **_AUTHORIZATION_RESPONSES,
        **_NOT_FOUND_RESPONSES,
        **_CONFLICT_RESPONSES,
    },
)
def modify_employee(
    employee_id: Annotated[int, Path(gt=0, description="Positive employee ID.")],
    employee_data: EmployeeUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[
        User, Depends(require_roles(UserRole.ADMIN, UserRole.HR))
    ],
) -> EmployeeResponse:
    try:
        employee = update_employee(db, employee_id, employee_data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Employee code or email already exists",
        ) from None

    if employee is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return employee


@router.delete(
    "/{employee_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    description="Deactivates an employee. Requires the ADMIN role.",
    responses={
        **_AUTHENTICATION_RESPONSES,
        **_AUTHORIZATION_RESPONSES,
        **_NOT_FOUND_RESPONSES,
    },
)
def remove_employee(
    employee_id: Annotated[int, Path(gt=0, description="Positive employee ID.")],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_roles(UserRole.ADMIN))],
) -> Response:
    if not delete_employee(db, employee_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Employee not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
