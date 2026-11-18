from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token
from ..middleware.auth_middleware import auth_required, get_current_user
from ..models import User, db
from ..utils.validators import is_valid_email, validate_password

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.post('/register')
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    phone = (data.get('phone') or '').strip()
    address = (data.get('address') or '').strip()

    if not name or not email or not password:
        return jsonify({'error': 'Name, email, and password are required.'}), 400
    if not is_valid_email(email):
        return jsonify({'error': 'Please enter a valid email address.'}), 400

    ok, msg = validate_password(password)
    if not ok:
        return jsonify({'error': msg}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'An account with this email already exists.'}), 409

    user = User(name=name, email=email, phone=phone, address=address, role='customer')
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 201


@auth_bp.post('/login')
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required.'}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password.'}), 401

    token = create_access_token(identity=str(user.id))
    return jsonify({'token': token, 'user': user.to_dict()}), 200


@auth_bp.get('/profile')
@auth_required
def get_profile():
    user = get_current_user()
    return jsonify({'user': user.to_dict()}), 200


@auth_bp.put('/profile')
@auth_required
def update_profile():
    user = get_current_user()
    data = request.get_json(silent=True) or {}

    if data.get('new_password'):
        current_pw = data.get('current_password') or ''
        if not user.check_password(current_pw):
            return jsonify({'error': 'Current password is incorrect.'}), 400
        ok, msg = validate_password(data['new_password'])
        if not ok:
            return jsonify({'error': msg}), 400
        user.set_password(data['new_password'])

    if data.get('name'):
        user.name = data['name'].strip()
    if 'phone' in data:
        user.phone = (data['phone'] or '').strip()
    if 'address' in data:
        user.address = (data['address'] or '').strip()

    db.session.commit()
    return jsonify({'user': user.to_dict()}), 200
