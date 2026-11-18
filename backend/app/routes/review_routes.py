from flask import Blueprint, jsonify, request
from sqlalchemy import func
from ..middleware.auth_middleware import auth_required, get_current_user
from ..models import Product, Review, db

review_bp = Blueprint('reviews', __name__, url_prefix='/api')


@review_bp.get('/products/<int:product_id>/reviews')
def get_product_reviews(product_id: int):
    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc()).all()
    return jsonify({'reviews': [r.to_dict() for r in reviews]}), 200


@review_bp.post('/reviews')
@auth_required
def create_review():
    user = get_current_user()
    data = request.get_json(silent=True) or {}
    product_id = data.get('product_id')
    rating = data.get('rating')
    review_text = (data.get('review_text') or '').strip()

    if not product_id or not rating or not review_text:
        return jsonify({'error': 'Product ID, rating (1-5), and review comment are required.'}), 400

    try:
        rating_int = int(rating)
    except (TypeError, ValueError):
        return jsonify({'error': 'Rating must be an integer between 1 and 5.'}), 400

    if rating_int < 1 or rating_int > 5:
        return jsonify({'error': 'Rating must be between 1 and 5.'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found.'}), 404

    review = Review(user_id=user.id, product_id=product.id, rating=rating_int, review_text=review_text)
    db.session.add(review)
    db.session.flush()

    avg_rating = db.session.query(func.round(func.avg(Review.rating), 1)).filter_by(product_id=product.id).scalar()
    product.rating = float(avg_rating or rating_int)
    db.session.commit()

    return jsonify({'review': review.to_dict(), 'updated_rating': product.rating}), 201
