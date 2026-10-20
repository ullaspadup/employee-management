from datetime import date
from decimal import Decimal

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.dependencies import get_current_user
from app.api.employees import router
from app.db.session import get_db
from app.models.employee import Employee
from app.models.user import User


@pytest.fixture
def employee_api():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Employee.__table__.create(engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_get_db():
        with session_factory() as session:
            yield session

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = override_get_db
    app.state.test_user_role = "EMPLOYEE"

    def override_current_user():
        return User(
            id=1,
            username="test-user",
            email="test@example.com",
            password_hash="unused",
            role=app.state.test_user_role,
        )

    app.dependency_overrides[get_current_user] = override_current_user

    with TestClient(app) as client:
        yield client, session_factory

    app.dependency_overrides.clear()
    engine.dispose()


def seed_employees(session_factory):
    employees = [
        Employee(
            id=3,
            employee_code="E3",
            first_name="Zoe",
            last_name="Three",
            email="zoe@example.com",
            department="Engineering",
            designation="Analyst",
            joining_date=date(2022, 1, 1),
            salary=Decimal("500"),
            is_active=True,
        ),
        Employee(
            id=1,
            employee_code="E1",
            first_name="Mia",
            last_name="One",
            email="mia@example.com",
            department="Engineering",
            designation="Manager",
            joining_date=date(2020, 1, 1),
            salary=Decimal("300"),
            is_active=True,
        ),
        Employee(
            id=2,
            employee_code="E2",
            first_name="Ava",
            last_name="Two",
            email="ava@example.com",
            department="HR",
            designation="Specialist",
            joining_date=date(2021, 1, 1),
            salary=Decimal("400"),
            is_active=True,
        ),
    ]
    with session_factory() as session:
        session.add_all(employees)
        session.commit()


def seed_mixed_status_employees(session_factory):
    seed_employees(session_factory)
    with session_factory() as session:
        session.query(Employee).filter(Employee.id.in_([2, 3])).update(
            {Employee.is_active: False}, synchronize_session=False
        )
        session.commit()


def test_employee_list_defaults_to_id_ascending(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get("/api/v1/employees")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [1, 2, 3]


def test_employee_list_sorts_salary_descending(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get("/api/v1/employees?sort_by=salary&sort_order=desc")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [3, 2, 1]


def test_employee_list_sorts_first_name_ascending(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get("/api/v1/employees?sort_by=first_name&sort_order=asc")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [2, 1, 3]


def test_employee_list_rejects_invalid_sort_by(employee_api):
    client, _ = employee_api

    response = client.get("/api/v1/employees?sort_by=password_hash")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported sort field: password_hash"


def test_employee_list_rejects_invalid_sort_order(employee_api):
    client, _ = employee_api

    response = client.get("/api/v1/employees?sort_order=random")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported sort order: random"


def test_employee_list_combines_department_filter_with_sorting(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get(
        "/api/v1/employees?department=Engineering&sort_by=salary&sort_order=desc"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [3, 1]
    assert response.json()["total"] == 2


def test_employee_list_combines_sorting_with_pagination(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get(
        "/api/v1/employees?sort_by=first_name&sort_order=asc&skip=1&limit=1"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [1]
    assert response.json()["total"] == 3
    assert response.json()["skip"] == 1
    assert response.json()["limit"] == 1


def test_employee_search_defaults_to_id_ascending(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get("/api/v1/employees/search?search=e")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [1, 2, 3]


def test_employee_search_sorts_salary_descending(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get(
        "/api/v1/employees/search?search=e&sort_by=salary&sort_order=desc"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [3, 2, 1]


def test_employee_search_sorts_first_name_ascending(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get(
        "/api/v1/employees/search?search=e&sort_by=first_name&sort_order=asc"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [2, 1, 3]


def test_employee_search_rejects_invalid_sort_by(employee_api):
    client, _ = employee_api

    response = client.get("/api/v1/employees/search?search=e&sort_by=password_hash")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported sort field: password_hash"


def test_employee_search_rejects_invalid_sort_order(employee_api):
    client, _ = employee_api

    response = client.get("/api/v1/employees/search?search=e&sort_order=random")

    assert response.status_code == 400
    assert response.json()["detail"] == "Unsupported sort order: random"


def test_employee_search_combines_search_with_sorting(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get(
        "/api/v1/employees/search?search=Engineering&sort_by=salary&sort_order=desc"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [3, 1]
    assert response.json()["total"] == 2


def test_employee_search_combines_sorting_with_pagination(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.get(
        "/api/v1/employees/search?search=Engineering&sort_by=salary&sort_order=desc&skip=1&limit=1"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [1]
    assert response.json()["total"] == 2
    assert response.json()["skip"] == 1
    assert response.json()["limit"] == 1


def test_employee_list_status_defaults_to_active_and_supports_each_status(employee_api):
    client, session_factory = employee_api
    seed_mixed_status_employees(session_factory)

    default_response = client.get("/api/v1/employees")
    active_response = client.get("/api/v1/employees?status=active")
    inactive_response = client.get("/api/v1/employees?status=inactive")
    all_response = client.get("/api/v1/employees?status=all")

    assert [item["id"] for item in default_response.json()["items"]] == [1]
    assert default_response.json()["total"] == 1
    assert [item["id"] for item in active_response.json()["items"]] == [1]
    assert [item["id"] for item in inactive_response.json()["items"]] == [2, 3]
    assert inactive_response.json()["total"] == 2
    assert [item["id"] for item in all_response.json()["items"]] == [1, 2, 3]
    assert all_response.json()["total"] == 3


@pytest.mark.parametrize(
    ("employee_status", "expected_total", "expected_ids"),
    [("active", 1, []), ("inactive", 2, [3]), ("all", 3, [2])],
)
def test_employee_list_status_filters_before_pagination(
    employee_api, employee_status, expected_total, expected_ids
):
    client, session_factory = employee_api
    seed_mixed_status_employees(session_factory)

    response = client.get(
        f"/api/v1/employees?status={employee_status}&skip=1&limit=1"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == expected_ids
    assert response.json()["total"] == expected_total
    assert response.json()["skip"] == 1
    assert response.json()["limit"] == 1


def test_employee_list_combines_status_with_filters_sorting_and_pagination(employee_api):
    client, session_factory = employee_api
    seed_mixed_status_employees(session_factory)

    filtered = client.get(
        "/api/v1/employees?status=inactive&department=Engineering"
        "&designation=Analyst&sort_by=salary&sort_order=desc"
    )
    sorted_page = client.get(
        "/api/v1/employees?status=inactive&sort_by=salary&sort_order=asc"
        "&skip=1&limit=1"
    )

    assert [item["id"] for item in filtered.json()["items"]] == [3]
    assert filtered.json()["total"] == 1
    assert [item["id"] for item in sorted_page.json()["items"]] == [3]
    assert sorted_page.json()["total"] == 2


def test_employee_search_combines_status_with_search_sorting_and_pagination(employee_api):
    client, session_factory = employee_api
    seed_mixed_status_employees(session_factory)

    response = client.get(
        "/api/v1/employees/search?search=e&status=inactive"
        "&sort_by=salary&sort_order=desc&skip=0&limit=1"
    )
    default_response = client.get("/api/v1/employees/search?search=e")
    empty_response = client.get(
        "/api/v1/employees/search?search=e&status=active"
    )
    all_response = client.get(
        "/api/v1/employees/search?search=e&status=all&sort_by=salary&sort_order=asc"
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [3]
    assert response.json()["total"] == 2
    assert response.json()["skip"] == 0
    assert response.json()["limit"] == 1
    assert [item["id"] for item in default_response.json()["items"]] == [1]
    assert default_response.json()["total"] == 1
    assert empty_response.status_code == 200
    assert [item["id"] for item in empty_response.json()["items"]] == [1]
    assert empty_response.json()["total"] == 1
    assert [item["id"] for item in all_response.json()["items"]] == [1, 2, 3]
    assert all_response.json()["total"] == 3


@pytest.mark.parametrize("path", ["/api/v1/employees", "/api/v1/employees/search?search=e"])
def test_employee_list_routes_reject_invalid_status(employee_api, path):
    client, _ = employee_api

    response = client.get(f"{path}&status=archived" if "?" in path else f"{path}?status=archived")

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"][-1] == "status"


def test_status_filter_does_not_bypass_authentication(employee_api):
    client, _ = employee_api
    current_user_override = client.app.dependency_overrides.pop(get_current_user)
    try:
        responses = [
            client.get("/api/v1/employees"),
            client.get("/api/v1/employees?status=inactive"),
            client.get("/api/v1/employees?status=all"),
            client.get("/api/v1/employees/search?search=e&status=inactive"),
        ]
    finally:
        client.app.dependency_overrides[get_current_user] = current_user_override

    assert all(response.status_code in (401, 403) for response in responses)
    assert len({response.status_code for response in responses}) == 1


def test_status_filter_does_not_change_lifecycle_role_permissions(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)

    response = client.patch("/api/v1/employees/2/activate")
    assert response.status_code == 403
    response = client.delete("/api/v1/employees/1")
    assert response.status_code == 403

    client.app.state.test_user_role = "HR"
    response = client.patch("/api/v1/employees/2/activate")
    assert response.status_code == 200
    response = client.delete("/api/v1/employees/1")
    assert response.status_code == 403

    client.app.state.test_user_role = "ADMIN"
    response = client.delete("/api/v1/employees/1")
    assert response.status_code == 204


def test_deactivation_and_reactivation_move_employees_between_status_results(employee_api):
    client, session_factory = employee_api
    seed_employees(session_factory)
    client.app.state.test_user_role = "ADMIN"

    deactivated = client.delete("/api/v1/employees/2")
    active_after_deactivation = client.get("/api/v1/employees?status=active")
    inactive_after_deactivation = client.get("/api/v1/employees?status=inactive")

    assert deactivated.status_code == 204
    assert [item["id"] for item in active_after_deactivation.json()["items"]] == [1, 3]
    assert [item["id"] for item in inactive_after_deactivation.json()["items"]] == [2]

    client.app.state.test_user_role = "HR"
    reactivated = client.patch("/api/v1/employees/2/activate")
    active_after_reactivation = client.get("/api/v1/employees?status=active")
    inactive_after_reactivation = client.get("/api/v1/employees?status=inactive")

    assert reactivated.status_code == 200
    assert reactivated.json()["is_active"] is True
    assert [item["id"] for item in active_after_reactivation.json()["items"]] == [1, 2, 3]
    assert inactive_after_reactivation.json()["items"] == []
