import argparse
import sys
from getpass import getpass
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError


backend_root = str(Path(__file__).resolve().parents[1])
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.core.roles import UserRole
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.user import User


def main() -> int:
    parser = argparse.ArgumentParser(description="Create or promote an admin user")
    parser.add_argument("--username", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(User.username == args.username))
        if user is None:
            password = getpass("Password for new admin: ")
            if not password:
                print("Password cannot be empty.", file=sys.stderr)
                return 1

            user = User(
                username=args.username,
                email=args.email,
                password_hash=hash_password(password),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(user)
            success_message = "Admin user created."
        else:
            user.role = UserRole.ADMIN
            success_message = "Existing user promoted to ADMIN."

        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            print("Username or email already exists.", file=sys.stderr)
            return 1

        print(success_message)
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())