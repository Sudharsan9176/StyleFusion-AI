from flask import Blueprint, jsonify, request
from ..middleware.auth_middleware import auth_required, get_current_user
from ..models import CartItem, Product, db
from ..services.order_service import compute_cart_summary

cart_bp = Blueprint('cart', __name__, url_prefix='/api/cart')


def _cart_response(user_id: int):
    items = CartItem.query.filter_by(user_id=user_id).order_by(CartItem.id.desc()).all()
    return {'items': [i.to_dict() for i in items], 'summary': compute_cart_summary(items)}


@cart_bp.get('')
@auth_required
def get_cart():
    user = get_current_user()
    return jsonify(_cart_response(user.id)), 200


@cart_bp.post('')
@auth_required
def add_to_cart():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    product_id = data.get('product_id')
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found.'}), 404
    if product.stock <= 0:
        return jsonify({'error': 'This item is currently out of stock.'}), 400

    p_dict = product.to_dict()
    size = str(data.get('selected_size') or (p_dict['sizes'][0] if p_dict['sizes'] else 'M'))
    color = str(data.get('selected_color') or (p_dict['colors'][0] if p_dict['colors'] else 'Black'))
    qty = max(1, int(data.get('quantity') or 1))

    existing = CartItem.query.filter_by(
        user_id=user.id, product_id=product.id, selected_size=size, selected_color=color
    ).first()

    if existing:
        existing.quantity = min(product.stock, existing.quantity + qty)
    else:
        item = CartItem(
            user_id=user.id,
            product_id=product.id,
            quantity=min(product.stock, qty),
            selected_size=size,
            selected_color=color,
        )
        db.session.add(item)

    db.session.commit()
    return jsonify(_cart_response(user.id)), 201


@cart_bp.put('/<int:item_id>')
@auth_required
def update_cart_item(item_id: int):
    user = get_current_user()
    item = CartItem.query.filter_by(id=item_id, user_id=user.id).first()
    if not item:
        return jsonify({'error': 'Cart item not found.'}), 404

    data = request.get_json(silent=True) or {}
    if 'quantity' in data:
        qty = int(data['quantity'])
        if qty <= 0:
            db.session.delete(item)
            db.session.commit()
            return jsonify(_cart_response(user.id)), 200
        item.quantity = min(item.product.stock, qty)

    if data.get('selected_size'):
        item.selected_size = str(data['selected_size'])
    if data.get('selected_color'):
        item.selected_color = str(data['selected_color'])

    db.session.commit()
    return jsonify(_cart_response(user.id)), 200


@cart_bp.delete('/<int:item_id>')
@auth_required
def delete_cart_item(item_id: int):
    user = get_current_user()
    item = CartItem.query.filter_by(id=item_id, user_id=user.id).first()
    if not item:
        return jsonify({'error': 'Cart item not found.'}), 404

    db.session.delete(item)
    db.session.commit()
    return jsonify(_cart_response(user.id)), 200
