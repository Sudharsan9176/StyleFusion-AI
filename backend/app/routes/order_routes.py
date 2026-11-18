from flask import Blueprint, jsonify, request
from ..middleware.auth_middleware import auth_required, get_current_user
from ..models import Order
from ..services.order_service import OrderServiceError, cancel_user_order, create_order_from_cart

order_bp = Blueprint('orders', __name__, url_prefix='/api/orders')


@order_bp.post('')
@auth_required
def place_order():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    try:
        order = create_order_from_cart(
            user_id=user.id,
            shipping_address=data.get('shipping_address') or '',
            payment_method=data.get('payment_method') or 'Cash on Delivery',
            card_last4=data.get('card_last4'),
        )
        return jsonify({'order': order.to_dict()}), 201
    except OrderServiceError as exc:
        return jsonify({'error': str(exc)}), exc.status_code


@order_bp.get('')
@auth_required
def list_orders():
    user = get_current_user()
    orders = Order.query.filter_by(user_id=user.id).order_by(Order.created_at.desc(), Order.id.desc()).all()
    return jsonify({'orders': [o.to_dict() for o in orders]}), 200


@order_bp.get('/<int:order_id>')
@auth_required
def get_order(order_id: int):
    user = get_current_user()
    order = Order.query.get(order_id)
    if not order or (order.user_id != user.id and user.role != 'admin'):
        return jsonify({'error': 'Order not found.'}), 404
    return jsonify({'order': order.to_dict()}), 200


@order_bp.post('/<int:order_id>/cancel')
@auth_required
def cancel_order(order_id: int):
    user = get_current_user()
    order = Order.query.filter_by(id=order_id, user_id=user.id).first()
    if not order:
        return jsonify({'error': 'Order not found.'}), 404
    try:
        updated = cancel_user_order(order)
        return jsonify({'order': updated.to_dict()}), 200
    except OrderServiceError as exc:
        return jsonify({'error': str(exc)}), exc.status_code
