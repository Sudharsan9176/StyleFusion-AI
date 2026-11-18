import json
from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_
from ..models import Product, Review, db

product_bp = Blueprint('products', __name__, url_prefix='/api')


@product_bp.get('/categories')
def get_categories():
    rows = (
        db.session.query(Product.category, func.count(Product.id))
        .group_by(Product.category)
        .order_by(Product.category.asc())
        .all()
    )
    return jsonify({'categories': [{'category': cat, 'count': cnt} for cat, cnt in rows]}), 200


@product_bp.get('/products')
def list_products():
    search = (request.args.get('search') or '').strip()
    category = (request.args.get('category') or '').strip()
    size = (request.args.get('size') or '').strip()
    color = (request.args.get('color') or '').strip()
    min_price = request.args.get('min_price', type=float)
    max_price = request.args.get('max_price', type=float)
    sort = (request.args.get('sort') or 'newest').strip()
    page = max(1, request.args.get('page', default=1, type=int))
    limit = min(50, max(1, request.args.get('limit', default=12, type=int)))

    query = Product.query

    if search:
        like_term = f'%{search}%'
        query = query.filter(
            or_(
                Product.name.ilike(like_term),
                Product.description.ilike(like_term),
                Product.brand.ilike(like_term),
                Product.category.ilike(like_term),
            )
        )

    if category and category.lower() != 'all':
        query = query.filter(func.lower(Product.category) == category.lower())

    if size:
        query = query.filter(Product.sizes.contains(f'"{size}"'))

    if color:
        query = query.filter(Product.colors.ilike(f'%"{color}"%'))

    effective_price = func.coalesce(Product.discount_price, Product.price)
    if min_price is not None:
        query = query.filter(effective_price >= min_price)
    if max_price is not None:
        query = query.filter(effective_price <= max_price)

    if sort == 'price_asc':
        query = query.order_by(effective_price.asc())
    elif sort == 'price_desc':
        query = query.order_by(effective_price.desc())
    elif sort == 'rating':
        query = query.order_by(Product.rating.desc(), Product.id.desc())
    else:
        query = query.order_by(Product.created_at.desc(), Product.id.desc())

    pagination = query.paginate(page=page, per_page=limit, error_out=False)

    return jsonify(
        {
            'products': [p.to_dict() for p in pagination.items],
            'pagination': {
                'total': pagination.total,
                'page': page,
                'limit': limit,
                'pages': max(1, pagination.pages),
            },
        }
    ), 200


@product_bp.get('/products/<int:product_id>')
def get_product(product_id: int):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found.'}), 404

    reviews = Review.query.filter_by(product_id=product_id).order_by(Review.created_at.desc()).all()
    return jsonify({'product': product.to_dict(), 'reviews': [r.to_dict() for r in reviews]}), 200
