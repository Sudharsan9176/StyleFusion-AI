from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request
from .auth_middleware import get_current_user


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required.'}), 401
        if user.role != 'admin':
            return jsonify({'error': 'Administrator access required.'}), 403
        return fn(*args, **kwargs)

    return wrapper
