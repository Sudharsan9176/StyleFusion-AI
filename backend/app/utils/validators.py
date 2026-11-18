import re


def is_valid_email(email: str) -> bool:
    return bool(re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email.strip()))


def validate_password(password: str) -> tuple[bool, str]:
    if not password or len(password) < 8:
        return False, 'Password must be at least 8 characters long.'
    return True, ''
