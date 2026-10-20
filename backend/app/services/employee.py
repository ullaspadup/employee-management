from typing import Literal

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate, EmployeeUpdate


_EMPLOYEE_SORT_COLUMNS = {
    "id": Employee.id,
    "employee_code": Employee.employee_code,
    "first_name": Employee.first_name,
    "last_name": Employee.last_name,
    "department": Employee.department,
    "designation": Employee.designation,
    "joining_date": Employee.joining_date,
    "salary": Employee.salary,
}

EmployeeStatus = Literal["active", "inactive", "all"]


def _get_sort_clause(sort_by: str, sort_order: str):
    column = _EMPLOYEE_SORT_COLUMNS.get(sort_by)
    if column is None:
        raise ValueError(f"Unsupported sort field: {sort_by}")

    if sort_order == "asc":
        return asc(column)
    if sort_order == "desc":
        return desc(column)
    raise ValueError(f"Unsupported sort order: {sort_order}")


def _get_employee_status_condition(employee_status: EmployeeStatus):
    if employee_status == "active":
        return Employee.is_active.is_(True)
    if employee_status == "inactive":
        return Employee.is_active.is_(False)
    return None


def create_employee(db: Session, employee_data: EmployeeCreate) -> Employee:
    employee = Employee(**employee_data.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


def get_employee(db: Session, employee_id: int) -> Employee | None:
    statement = select(Employee).where(Employee.id == employee_id)
    return db.scalar(statement)


def get_employees(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    department: str | None = None,
    designation: str | None = None,
    sort_by: str = "id",
    sort_order: str = "asc",
    employee_status: EmployeeStatus = "active",
) -> tuple[list[Employee], int]:
    order_clause = _get_sort_clause(sort_by, sort_order)

    status_condition = _get_employee_status_condition(employee_status)
    filter_conditions = [status_condition] if status_condition is not None else []
    if department is not None:
        filter_conditions.append(Employee.department.ilike(department))
    if designation is not None:
        filter_conditions.append(Employee.designation.ilike(designation))

    statement = (
        select(Employee)
        .where(*filter_conditions)
        .order_by(order_clause)
        .offset(skip)
        .limit(limit)
    )
    employees = list(db.scalars(statement).all())

    count_statement = (
        select(func.count())
        .select_from(Employee)
        .where(*filter_conditions)
    )
    total = db.scalar(count_statement)
    return employees, int(total or 0)


def update_employee(
    db: Session,
    employee_id: int,
    employee_data: EmployeeUpdate,
) -> Employee | None:
    employee = get_employee(db, employee_id)
    if employee is None:
        return None

    for field, value in employee_data.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)

    db.commit()
    db.refresh(employee)
    return employee


def delete_employee(db: Session, employee_id: int) -> bool:
    employee = get_employee(db, employee_id)
    if employee is None:
        return False

    employee.is_active = False
    db.commit()
    db.refresh(employee)
    return True


def reactivate_employee(db: Session, employee_id: int) -> bool:
    employee = get_employee(db, employee_id)
    if employee is None:
        return False
    if employee.is_active:
        return True

    employee.is_active = True
    db.commit()
    db.refresh(employee)
    return True


def search_employees(
    db: Session,
    search: str,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = "id",
    sort_order: str = "asc",
    employee_status: EmployeeStatus = "active",
) -> tuple[list[Employee], int]:
    search_pattern = f"%{search}%"
    order_clause = _get_sort_clause(sort_by, sort_order)
    filter_conditions = (
        or_(
            Employee.employee_code.ilike(search_pattern),
            Employee.first_name.ilike(search_pattern),
            Employee.last_name.ilike(search_pattern),
            Employee.email.ilike(search_pattern),
            Employee.department.ilike(search_pattern),
            Employee.designation.ilike(search_pattern),
        ),
    )
    status_condition = _get_employee_status_condition(employee_status)
    if status_condition is not None:
        filter_conditions = (status_condition, *filter_conditions)
    statement = (
        select(Employee)
        .where(*filter_conditions)
        .order_by(order_clause)
        .offset(skip)
        .limit(limit)
    )
    employees = list(db.scalars(statement).all())

    count_statement = (
        select(func.count())
        .select_from(Employee)
        .where(*filter_conditions)
    )
    total = db.scalar(count_statement)
    return employees, int(total or 0)
