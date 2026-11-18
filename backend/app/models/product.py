import json
from datetime import datetime, timezone
from . import db


class Product(db.Model):
    __tablename__ = 'products'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False, index=True)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(80), nullable=False, index=True)
    brand = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    discount_price = db.Column(db.Float, nullable=True)
    sizes = db.Column(db.Text, nullable=False, default='["S","M","L","XL"]')
    colors = db.Column(db.Text, nullable=False, default='["Black"]')
    image = db.Column(db.String(500), nullable=False)
    stock = db.Column(db.Integer, nullable=False, default=0)
    rating = db.Column(db.Float, nullable=False, default=0.0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    reviews = db.relationship('Review', backref='product', cascade='all, delete-orphan')
    cart_items = db.relationship('CartItem', backref='product', cascade='all, delete-orphan')
    wishlist_items = db.relationship('WishlistItem', backref='product', cascade='all, delete-orphan')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'brand': self.brand,
            'price': float(self.price),
            'discount_price': float(self.discount_price) if self.discount_price is not None else None,
            'sizes': json.loads(self.sizes) if self.sizes else ['S', 'M', 'L'],
            'colors': json.loads(self.colors) if self.colors else ['Black'],
            'image': self.image,
            'stock': int(self.stock),
            'rating': float(self.rating),
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
