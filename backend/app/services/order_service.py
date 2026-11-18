from ..models import CartItem, Order, OrderItem, Product, db


class OrderServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def compute_cart_summary(cart_items: list[CartItem]) -> dict:
    subtotal = 0.0
    discount = 0.0
    item_count = 0

    for item in cart_items:
        prod = item.product
        regular = float(prod.price)
        effective = float(prod.discount_price) if prod.discount_price is not None else regular
        subtotal += regular * item.quantity
        discount += (regular - effective) * item.quantity
        item_count += item.quantity

    discounted_subtotal = subtotal - discount
    shipping = 0.0 if not cart_items or discounted_subtotal >= 250.0 else 15.0
    total = discounted_subtotal + shipping

    return {
        'item_count': item_count,
        'subtotal': round(subtotal, 2),
        'discount': round(discount, 2),
        'shipping': round(shipping, 2),
        'total': round(total, 2),
    }


def create_order_from_cart(user_id: int, shipping_address: str, payment_method: str, card_last4: str | None = None) -> Order:
    if not shipping_address or len(shipping_address.strip()) < 8:
        raise OrderServiceError('Please provide a complete shipping address.')

    if payment_method not in ('Cash on Delivery', 'Test Card Payment'):
        raise OrderServiceError('Unsupported payment method.')

    if payment_method == 'Test Card Payment' and (not card_last4 or len(card_last4) != 4):
        raise OrderServiceError('Valid test card details are required.')

    cart_items = CartItem.query.filter_by(user_id=user_id).all()
    if not cart_items:
        raise OrderServiceError('Your shopping bag is empty.')

    for item in cart_items:
        if item.product.stock < item.quantity:
            raise OrderServiceError(f'Insufficient stock for {item.product.name}.')

    summary = compute_cart_summary(cart_items)
    payment_status = 'Paid (Test Mode)' if payment_method == 'Test Card Payment' else 'Pending (COD)'
    order_status = 'Confirmed' if payment_method == 'Test Card Payment' else 'Pending'

    order = Order(
        user_id=user_id,
        total_amount=summary['total'],
        shipping_address=shipping_address.strip(),
        payment_method=payment_method,
        payment_status=payment_status,
        order_status=order_status,
    )
    db.session.add(order)
    db.session.flush()

    for item in cart_items:
        unit_price = float(item.product.discount_price) if item.product.discount_price is not None else float(item.product.price)
        order_item = OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            size=item.selected_size,
            color=item.selected_color,
            price=unit_price,
        )
        item.product.stock -= item.quantity
        db.session.add(order_item)

    CartItem.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    return order


def cancel_user_order(order: Order) -> Order:
    if order.order_status not in ('Pending', 'Confirmed'):
        raise OrderServiceError(f'Cannot cancel order in "{order.order_status}" stage.')

    for item in order.items:
        prod = Product.query.get(item.product_id)
        if prod:
            prod.stock += item.quantity

    order.order_status = 'Cancelled'
    db.session.commit()
    return order
