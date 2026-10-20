from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmployeeCreate(BaseModel):
    employee_code: str = Field(max_length=30)
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    department: str = Field(max_length=100)
    designation: str = Field(max_length=150)
    joining_date: date
    salary: Decimal = Field(ge=0)
    is_active: bool = True


class EmployeeUpdate(BaseModel):
    employee_code: str = Field(default=None, max_length=30)
    first_name: str = Field(default=None, max_length=100)
    last_name: str = Field(default=None, max_length=100)
    email: EmailStr = None
    phone: str | None = Field(default=None, max_length=30)
    department: str = Field(default=None, max_length=100)
    designation: str = Field(default=None, max_length=150)
    joining_date: date = None
    salary: Decimal = Field(default=None, ge=0)


class EmployeeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    employee_code: str = Field(max_length=30)
    first_name: str = Field(max_length=100)
    last_name: str = Field(max_length=100)
    email: EmailStr
    phone: str | None = Field(max_length=30)
    department: str = Field(max_length=100)
    designation: str = Field(max_length=150)
    joining_date: date
    salary: Decimal = Field(ge=0)
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmployeeListResponse(BaseModel):
    items: list[EmployeeResponse]
    total: int = Field(ge=0)
    skip: int = Field(ge=0)
    limit: int = Field(ge=1)