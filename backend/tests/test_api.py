import io
import json
import os
import tempfile
from unittest.mock import patch
import pytest
from PIL import Image

from app import create_app
from app.models import Product, User, db
from app.services.huggingface_service import HuggingFaceServiceError


def make_test_image_bytes(width=320, height=400, fmt='PNG'):
    img = Image.new('RGB', (width, height), color=(240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    buf.seek(0)
    return buf


@pytest.fixture
def client():
    tmp_dir = tempfile.mkdtemp()
    app = create_app(
        {
            'TESTING': True,
            'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
            'JWT_SECRET_KEY': 'test-jwt-secret',
            'UPLOAD_FOLDER': os.path.join(tmp_dir, 'uploads'),
            'GENERATED_FOLDER': os.path.join(tmp_dir, 'generated'),
        }
    )

    with app.app_context():
        db.create_all()
        admin = User(name='Admin User', email='admin@test.com', role='admin')
        admin.set_password('AdminPass123')
        db.session.add(admin)

        product = Product(
            name='Test Tailored Wool Coat',
            description='Heavyweight wool coat for testing.',
            category='Jackets',
            brand='Atelier Vera',
            price=450.0,
            discount_price=390.0,
            sizes=json.dumps(['S', 'M', 'L']),
            colors=json.dumps(['Black']),
            image='https://example.com/coat.jpg',
            stock=10,
            rating=4.8,
        )
        db.session.add(product)
        db.session.commit()

    with app.test_client() as test_client:
        yield test_client


def register_and_login(client, email='buyer@test.com', password='Password123'):
    res = client.post(
        '/api/auth/register',
        json={'name': 'Test Buyer', 'email': email, 'password': password},
    )
    assert res.status_code == 201
    return res.get_json()['token']


def login_admin(client):
    res = client.post(
        '/api/auth/login',
        json={'email': 'admin@test.com', 'password': 'AdminPass123'},
    )
    assert res.status_code == 200
    return res.get_json()['token']


def test_registration_and_login(client):
    token = register_and_login(client, 'claire@test.com', 'SecurePass99')
    assert token

    bad_login = client.post('/api/auth/login', json={'email': 'claire@test.com', 'password': 'wrong'})
    assert bad_login.status_code == 401

    good_login = client.post('/api/auth/login', json={'email': 'claire@test.com', 'password': 'SecurePass99'})
    assert good_login.status_code == 200
    assert good_login.get_json()['user']['email'] == 'claire@test.com'


def test_product_retrieval_and_search(client):
    res = client.get('/api/products')
    assert res.status_code == 200
    assert len(res.get_json()['products']) == 1

    search_hit = client.get('/api/products?search=Wool')
    assert search_hit.status_code == 200
    assert len(search_hit.get_json()['products']) == 1

    search_miss = client.get('/api/products?search=NonExistentItem')
    assert search_miss.status_code == 200
    assert len(search_miss.get_json()['products']) == 0


def test_cart_wishlist_and_checkout(client):
    token = register_and_login(client)
    headers = {'Authorization': f'Bearer {token}'}

    # Wishlist add & retrieve
    w_add = client.post('/api/wishlist', json={'product_id': 1}, headers=headers)
    assert w_add.status_code == 201
    w_get = client.get('/api/wishlist', headers=headers)
    assert len(w_get.get_json()['items']) == 1

    # Cart add & update
    c_add = client.post(
        '/api/cart',
        json={'product_id': 1, 'quantity': 2, 'selected_size': 'M', 'selected_color': 'Black'},
        headers=headers,
    )
    assert c_add.status_code == 201
    assert c_add.get_json()['summary']['item_count'] == 2

    # Checkout & order creation
    o_res = client.post(
        '/api/orders',
        json={'shipping_address': '42 Mercer Street, New York, NY 10013', 'payment_method': 'Cash on Delivery'},
        headers=headers,
    )
    assert o_res.status_code == 201
    order = o_res.get_json()['order']
    assert order['order_status'] == 'Pending'
    assert order['total_amount'] == 780.0

    # Verify stock decremented
    p_res = client.get('/api/products/1')
    assert p_res.get_json()['product']['stock'] == 8


def test_admin_authorization_and_product_crud(client):
    customer_token = register_and_login(client)
    forbidden = client.get('/api/admin/dashboard', headers={'Authorization': f'Bearer {customer_token}'})
    assert forbidden.status_code == 403

    admin_token = login_admin(client)
    allowed = client.get('/api/admin/dashboard', headers={'Authorization': f'Bearer {admin_token}'})
    assert allowed.status_code == 200
    assert allowed.get_json()['kpis']['total_products'] == 1

    # Admin product upload
    create_res = client.post(
        '/api/admin/products',
        data={
            'name': 'Silk Evening Shirt',
            'description': 'Organic silk shirt.',
            'category': 'Shirts',
            'brand': 'Atelier Vera',
            'price': '210',
            'stock': '15',
            'image_file': (make_test_image_bytes(300, 400), 'shirt.png'),
        },
        headers={'Authorization': f'Bearer {admin_token}'},
        content_type='multipart/form-data',
    )
    assert create_res.status_code == 201
    assert create_res.get_json()['product']['image'].startswith('/uploads/products/')


def test_tryon_upload_generation_and_error_handling(client):
    token = register_and_login(client)
    headers = {'Authorization': f'Bearer {token}'}

    # Invalid tiny image validation
    bad_img = make_test_image_bytes(64, 64)
    res_bad = client.post(
        '/api/tryon/generate',
        data={'product_id': '1', 'person_image': (bad_img, 'tiny.png')},
        headers=headers,
        content_type='multipart/form-data',
    )
    assert res_bad.status_code == 400

    # Successful HF inference call (mocking network transport)
    with patch('app.services.huggingface_service.HuggingFaceService.generate_tryon') as mock_hf:
        mock_hf.return_value = ('/tmp/out.png', '/generated/tryon_images/out.png', 'yisol/IDM-VTON')
        res_ok = client.post(
            '/api/tryon/generate',
            data={'product_id': '1', 'person_image': (make_test_image_bytes(512, 768), 'portrait.png')},
            headers=headers,
            content_type='multipart/form-data',
        )
        assert res_ok.status_code == 201
        sess = res_ok.get_json()['session']
        assert sess['status'] == 'completed'
        assert sess['generated_image_path'] == '/generated/tryon_images/out.png'

    # Error handling when Hugging Face endpoint fails / rate limits
    with patch('app.services.huggingface_service.HuggingFaceService.generate_tryon') as mock_fail:
        mock_fail.side_effect = HuggingFaceServiceError('ZeroGPU quota reached.', 429)
        res_err = client.post(
            '/api/tryon/generate',
            data={'product_id': '1', 'person_image': (make_test_image_bytes(512, 768), 'portrait2.png')},
            headers=headers,
            content_type='multipart/form-data',
        )
        assert res_err.status_code == 429
        assert 'ZeroGPU quota' in res_err.get_json()['error']
