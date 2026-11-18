import json
from flask import Blueprint, jsonify, request
from sqlalchemy import case, func
from ..middleware.admin_middleware import admin_required
from ..models import Order, OrderItem, Product, TryOnSession, User, db
from ..services.image_service import ImageValidationError, save_uploaded_image
from ..utils.helpers import parse_list_field

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')
ALLOWED_ORDER_STATUSES = {'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'}


@admin_bp.get('/dashboard')
@admin_required
def dashboard():
    total_revenue = (
        db.session.query(func.coalesce(func.sum(Order.total_amount), 0.0))
        .filter(Order.order_status != 'Cancelled')
        .scalar()
    )
    total_orders = db.session.query(func.count(Order.id)).scalar() or 0
    pending_orders = db.session.query(func.count(Order.id)).filter(Order.order_status == 'Pending').scalar() or 0
    total_customers = db.session.query(func.count(User.id)).filter(User.role == 'customer').scalar() or 0
    total_products = db.session.query(func.count(Product.id)).scalar() or 0
    total_stock = db.session.query(func.coalesce(func.sum(Product.stock), 0)).scalar() or 0
    low_stock_count = db.session.query(func.count(Product.id)).filter(Product.stock <= 5).scalar() or 0

    total_tryons = db.session.query(func.count(TryOnSession.id)).scalar() or 0
    completed_tryons = (
        db.session.query(func.count(TryOnSession.id)).filter(TryOnSession.status == 'completed').scalar() or 0
    )
    failed_tryons = (
        db.session.query(func.count(TryOnSession.id)).filter(TryOnSession.status == 'failed').scalar() or 0
    )

    cat_rows = (
        db.session.query(
            Product.category,
            func.count(Product.id).label('product_count'),
            func.coalesce(func.sum(Product.stock), 0).label('stock_count'),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.price), 0.0).label('revenue'),
        )
        .outerjoin(OrderItem, OrderItem.product_id == Product.id)
        .group_by(Product.category)
        .all()
    )

    status_rows = (
        db.session.query(
            Order.order_status,
            func.count(Order.id).label('count'),
            func.coalesce(func.sum(Order.total_amount), 0.0).label('amount'),
        )
        .group_by(Order.order_status)
        .all()
    )

    recent_tryons = TryOnSession.query.order_by(TryOnSession.created_at.desc(), TryOnSession.id.desc()).limit(10).all()

    return jsonify(
        {
            'kpis': {
                'total_revenue': round(float(total_revenue or 0.0), 2),
                'total_orders': int(total_orders),
                'pending_orders': int(pending_orders),
                'total_customers': int(total_customers),
                'total_products': int(total_products),
                'total_stock': int(total_stock),
                'low_stock_count': int(low_stock_count),
                'total_tryons': int(total_tryons),
                'completed_tryons': int(completed_tryons),
                'failed_tryons': int(failed_tryons),
            },
            'category_breakdown': [
                {
                    'category': r.category,
                    'product_count': int(r.product_count),
                    'stock_count': int(r.stock_count),
                    'revenue': round(float(r.revenue or 0.0), 2),
                }
                for r in cat_rows
            ],
            'order_status_breakdown': [
                {'status': r.order_status, 'count': int(r.count), 'amount': round(float(r.amount or 0.0), 2)}
                for r in status_rows
            ],
            'recent_tryons': [t.to_dict() for t in recent_tryons],
        }
    ), 200


@admin_bp.post('/products')
@admin_required
def create_product():
    data = request.form if request.form else (request.get_json(silent=True) or {})
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip()
    category = (data.get('category') or '').strip()
    brand = (data.get('brand') or '').strip()
    price = data.get('price')

    if not name or not description or not category or not brand or not price:
        return jsonify({'error': 'Name, description, category, brand, and price are required.'}), 400

    image_file = request.files.get('image_file') if request.files else None
    if image_file and image_file.filename:
        try:
            _, image_url = save_uploaded_image(image_file, 'products', min_dim=100)
        except ImageValidationError as exc:
            return jsonify({'error': str(exc)}), 400
    else:
        image_url = (data.get('image') or '').strip()

    if not image_url:
        return jsonify({'error': 'Please upload a product image or provide an image path.'}), 400

    discount_raw = data.get('discount_price')
    discount_price = float(discount_raw) if discount_raw not in (None, '', 'null') else None

    product = Product(
        name=name,
        description=description,
        category=category,
        brand=brand,
        price=float(price),
        discount_price=discount_price,
        sizes=json.dumps(parse_list_field(data.get('sizes'), ['S', 'M', 'L', 'XL'])),
        colors=json.dumps(parse_list_field(data.get('colors'), ['Black'])),
        image=image_url,
        stock=int(data.get('stock') or 0),
        rating=5.0,
    )
    db.session.add(product)
    db.session.commit()
    return jsonify({'product': product.to_dict()}), 201


@admin_bp.put('/products/<int:product_id>')
@admin_required
def update_product(product_id: int):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found.'}), 404

    data = request.form if request.form else (request.get_json(silent=True) or {})
    image_file = request.files.get('image_file') if request.files else None
    if image_file and image_file.filename:
        try:
            _, product.image = save_uploaded_image(image_file, 'products', min_dim=100)
        except ImageValidationError as exc:
            return jsonify({'error': str(exc)}), 400
    elif data.get('image'):
        product.image = data['image'].strip()

    if data.get('name'):
        product.name = data['name'].strip()
    if data.get('description'):
        product.description = data['description'].strip()
    if data.get('category'):
        product.category = data['category'].strip()
    if data.get('brand'):
        product.brand = data['brand'].strip()
    if data.get('price') is not None:
        product.price = float(data['price'])
    if 'discount_price' in data:
        val = data['discount_price']
        product.discount_price = None if val in (None, '', 'null') else float(val)
    if data.get('stock') is not None:
        product.stock = int(data['stock'])
    if data.get('sizes') is not None:
        product.sizes = json.dumps(parse_list_field(data['sizes'], ['S', 'M', 'L']))
    if data.get('colors') is not None:
        product.colors = json.dumps(parse_list_field(data['colors'], ['Black']))

    db.session.commit()
    return jsonify({'product': product.to_dict()}), 200


@admin_bp.delete('/products/<int:product_id>')
@admin_required
def delete_product(product_id: int):
    product = Product.query.get(product_id)
    if not product:
        return jsonify({'error': 'Product not found.'}), 404
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Product deleted successfully.'}), 200


@admin_bp.get('/orders')
@admin_required
def list_all_orders():
    orders = Order.query.order_by(Order.created_at.desc(), Order.id.desc()).all()
    return jsonify({'orders': [o.to_dict() for o in orders]}), 200


@admin_bp.put('/orders/<int:order_id>')
@admin_required
def update_order_status(order_id: int):
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found.'}), 404

    data = request.get_json(silent=True) or {}
    new_status = data.get('order_status')
    if new_status:
        if new_status not in ALLOWED_ORDER_STATUSES:
            return jsonify({'error': 'Invalid order status.'}), 400
        order.order_status = new_status
    if data.get('payment_status'):
        order.payment_status = data['payment_status']

    db.session.commit()
    return jsonify({'order': order.to_dict()}), 200


@admin_bp.get('/customers')
@admin_required
def list_customers():
    rows = (
        db.session.query(
            User,
            func.count(Order.id).label('order_count'),
            func.coalesce(
                func.sum(case((Order.order_status != 'Cancelled', Order.total_amount), else_=0.0)), 0.0
            ).label('total_spent'),
        )
        .outerjoin(Order, Order.user_id == User.id)
        .group_by(User.id)
        .order_by(User.created_at.desc())
        .all()
    )

    customers = []
    for user, order_count, total_spent in rows:
        item = user.to_dict()
        item['order_count'] = int(order_count)
        item['total_spent'] = round(float(total_spent or 0.0), 2)
        customers.append(item)

    return jsonify({'customers': customers}), 200
