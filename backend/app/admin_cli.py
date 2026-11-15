"""Provision administrator accounts from a trusted backend terminal."""

import argparse
import re

from sqlalchemy import select

from app.database import SessionLocal
from app.models.user import User

PHONE_PATTERN = re.compile(r"^\+91[6-9]\d{9}$")


def provision_admin(
    phone_e164: str,
    full_name: str,
    email: str | None = None,
    promote_existing: bool = False,
) -> str:
    phone_e164 = phone_e164.strip()
    full_name = full_name.strip()
    if not PHONE_PATTERN.fullmatch(phone_e164):
        raise ValueError("Phone number must be an Indian mobile in E.164 format, for example +919876543210")
    if not full_name:
        raise ValueError("Administrator name is required")

    with SessionLocal.begin() as db:
        user = db.scalar(
            select(User).where(User.phone_e164 == phone_e164).with_for_update()
        )
        if user:
            if user.role == "admin":
                return f"Administrator already provisioned: {phone_e164}"
            if not promote_existing:
                raise ValueError(
                    "This phone already belongs to a non-admin account. "
                    "Use --promote-existing only if you intend to grant it admin access."
                )
            user.role = "admin"
            user.full_name = full_name
            user.email = email or user.email
            user.is_active = True
        else:
            user = User(
                phone_e164=phone_e164,
                full_name=full_name,
                email=email,
                role="admin",
                is_active=True,
            )
            db.add(user)

    return f"Administrator provisioned: {phone_e164}"


def main() -> None:
    parser = argparse.ArgumentParser(description="Provision Kezza admin access")
    parser.add_argument("--phone", required=True, help="Admin phone in E.164 format")
    parser.add_argument("--name", required=True, help="Admin display name")
    parser.add_argument("--email", default=None, help="Optional admin email")
    parser.add_argument(
        "--promote-existing",
        action="store_true",
        help="Explicitly promote an existing patient/agent account to admin",
    )
    args = parser.parse_args()
    try:
        print(
            provision_admin(
                phone_e164=args.phone,
                full_name=args.name,
                email=args.email,
                promote_existing=args.promote_existing,
            )
        )
    except ValueError as exc:
        parser.error(str(exc))


if __name__ == "__main__":
    main()
