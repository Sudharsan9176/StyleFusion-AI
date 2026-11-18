from flask import Blueprint, jsonify, request
from ..middleware.auth_middleware import auth_required, get_current_user
from ..models import Product, WishlistItem, db

wishlist_bp = Blueprint('wishlist', __name__, url_prefix='/api/wishlist')


@wishlist_bp.get('')
@auth_required
def get_wishlist():
    user = get_current_user()
    items = WishlistItem.query.filter_by(user_id=user.id).order_by(WishlistItem.created_at.desc()).all()
    return jsonify({'items': [i.to_dict() for i in items]}), 200


@wishlist_bp.post('')
@auth_required
def add_to_wishlist():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    product_id = data.get('product_id')
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found.'}), 404

    existing = WishlistItem.query.filter_by(user_id=user.id, product_id=product.id).first()
    if not existing:
        db.session.add(WishlistItem(user_id=user.id, product_id=product.id))
        db.session.commit()

    return jsonify({'message': 'Added to wishlist.', 'product_id': product.id}), 201


@wishlist_bp.delete('/<int:product_id>')
@auth_required
def remove_from_wishlist(product_id: int):
    user = get_current_user()
    item = WishlistItem.query.filter_by(user_id=user.id, product_id=product_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    return jsonify({'message': 'Removed from wishlist.'}), 200
