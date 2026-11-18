import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from .config import Config
from .models import db
from .routes.admin_routes import admin_bp
from .routes.auth_routes import auth_bp
from .routes.cart_routes import cart_bp
from .routes.order_routes import order_bp
from .routes.product_routes import product_bp
from .routes.review_routes import review_bp
from .routes.tryon_routes import tryon_bp
from .routes.wishlist_routes import wishlist_bp


def create_app(config_override: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if config_override:
        app.config.update(config_override)

    os.makedirs(os.path.join(app.root_path, '..', 'instance'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'products'), exist_ok=True)
    os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'user_photos'), exist_ok=True)
    os.makedirs(os.path.join(app.config['GENERATED_FOLDER'], 'tryon_images'), exist_ok=True)

    db.init_app(app)
    JWTManager(app)
    CORS(app, resources={r'/api/*': {'origins': '*'}})

    app.register_blueprint(auth_bp)
    app.register_blueprint(product_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(wishlist_bp)
    app.register_blueprint(tryon_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(review_bp)
    app.register_blueprint(admin_bp)

    @app.get('/uploads/<path:filename>')
    def serve_uploads(filename):
        return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

    @app.get('/generated/<path:filename>')
    def serve_generated(filename):
        return send_from_directory(app.config['GENERATED_FOLDER'], filename)

    with app.app_context():
        db.create_all()

    return app
