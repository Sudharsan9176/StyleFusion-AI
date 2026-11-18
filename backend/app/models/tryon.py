from datetime import datetime, timezone
from . import db


class TryOnSession(db.Model):
    __tablename__ = 'tryon_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey('products.id', ondelete='CASCADE'), nullable=False)
    original_image_path = db.Column(db.String(500), nullable=False)
    generated_image_path = db.Column(db.String(500), nullable=True)
    model_name = db.Column(db.String(160), nullable=False)
    status = db.Column(db.String(30), nullable=False, default='pending')
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    product = db.relationship('Product')

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.name if self.user else None,
            'product_id': self.product_id,
            'product_name': self.product.name if self.product else None,
            'product_image': self.product.image if self.product else None,
            'product_category': self.product.category if self.product else None,
            'product_price': float(self.product.price) if self.product else None,
            'product_discount_price': float(self.product.discount_price)
            if self.product and self.product.discount_price is not None
            else None,
            'original_image_path': self.original_image_path,
            'generated_image_path': self.generated_image_path,
            'model_name': self.model_name,
            'status': self.status,
            'error_message': self.error_message,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
