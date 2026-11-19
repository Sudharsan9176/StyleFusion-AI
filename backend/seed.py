import json
from app import create_app
from app.models import Product, Review, User, db

SEEDED_PRODUCTS = [
    {
        'name': 'Double-Breasted Wool Overcoat',
        'description': 'Tailored from heavyweight Italian virgin wool with structured peak lapels, horn buttons, and full cupro lining.',
        'category': 'Jackets',
        'brand': 'StyleFusion AI',
        'price': 490.0,
        'discount_price': 420.0,
        'sizes': ['S', 'M', 'L', 'XL'],
        'colors': ['Black', 'Charcoal'],
        'image': '/src/assets/images/product_wool_overcoat_1794992372142.jpg',
        'stock': 18,
        'rating': 4.9,
    },
    {
        'name': 'Mulberry Silk Atelier Shirt',
        'description': 'Cut from 22-momme organic mulberry silk with mother-of-pearl buttons and fluid drape.',
        'category': 'Shirts',
        'brand': 'StyleFusion AI',
        'price': 220.0,
        'discount_price': 185.0,
        'sizes': ['XS', 'S', 'M', 'L', 'XL'],
        'colors': ['Ivory', 'White'],
        'image': '/src/assets/images/product_silk_shirt_1794992373173.jpg',
        'stock': 34,
        'rating': 4.8,
    },
    {
        'name': 'Charcoal Linen-Wool Formal Blazer',
        'description': 'Half-canvas tailored blazer crafted from breathable Belgian linen and fine merino wool.',
        'category': 'Formal Wear',
        'brand': 'Maison Nord',
        'price': 380.0,
        'discount_price': None,
        'sizes': ['S', 'M', 'L', 'XL'],
        'colors': ['Charcoal', 'Slate'],
        'image': '/src/assets/images/product_linen_blazer_1794992372231.jpg',
        'stock': 14,
        'rating': 4.7,
    },
    {
        'name': 'Heavyweight Combed Cotton Tee',
        'description': '310gsm organic combed cotton jersey t-shirt with a structured mock-rib collar.',
        'category': 'T-Shirts',
        'brand': 'Vera Basics',
        'price': 68.0,
        'discount_price': 54.0,
        'sizes': ['XS', 'S', 'M', 'L', 'XL'],
        'colors': ['White', 'Black'],
        'image': '/src/assets/images/product_ribbed_tee_1794992372654.jpg',
        'stock': 65,
        'rating': 4.8,
    },
    {
        'name': 'Pleated A-Line Midi Dress',
        'description': 'Architectural sleeveless midi dress in matte Japanese crepe featuring knife-pleated bodice paneling.',
        'category': 'Dresses',
        'brand': 'StyleFusion AI',
        'price': 340.0,
        'discount_price': 295.0,
        'sizes': ['XS', 'S', 'M', 'L'],
        'colors': ['Black'],
        'image': '/src/assets/images/product_midi_dress_1794992373277.jpg',
        'stock': 22,
        'rating': 4.9,
    },
    {
        'name': 'Japanese Selvedge Straight Jeans',
        'description': '14oz rope-dyed indigo selvedge denim woven on vintage shuttle looms in Okayama.',
        'category': 'Jeans',
        'brand': 'Kuro Denim',
        'price': 260.0,
        'discount_price': None,
        'sizes': ['28', '30', '32', '34', '36'],
        'colors': ['Indigo'],
        'image': '/src/assets/images/product_selvedge_jeans_1794992373960.jpg',
        'stock': 29,
        'rating': 4.7,
    },
    {
        'name': 'Full-Grain Calfskin Moto Jacket',
        'description': 'Supple vegetable-tanned Italian calfskin biker jacket with brushed silver hardware.',
        'category': "Men's Clothing",
        'brand': 'Maison Nord',
        'price': 680.0,
        'discount_price': 590.0,
        'sizes': ['S', 'M', 'L', 'XL'],
        'colors': ['Black'],
        'image': '/src/assets/images/product_leather_jacket_1794992374584.jpg',
        'stock': 9,
        'rating': 5.0,
    },
    {
        'name': 'Handloom Silk Mandarin Kurta',
        'description': 'Artisanal tussar-silk ethnic kurta featuring tonal Chikankari placket embroidery.',
        'category': 'Ethnic Wear',
        'brand': 'Vastra Heritage',
        'price': 195.0,
        'discount_price': 165.0,
        'sizes': ['S', 'M', 'L', 'XL'],
        'colors': ['Ivory', 'Sand'],
        'image': '/src/assets/images/product_ethnic_kurta_1794992375375.jpg',
        'stock': 25,
        'rating': 4.8,
    },
    {
        'name': 'Mongolian Cashmere Turtleneck',
        'description': 'Fine 12-gauge Grade-A Mongolian cashmere knit sweater with ribbed fold-over collar.',
        'category': 'Casual Wear',
        'brand': 'StyleFusion AI',
        'price': 290.0,
        'discount_price': 245.0,
        'sizes': ['XS', 'S', 'M', 'L', 'XL'],
        'colors': ['Slate', 'Charcoal'],
        'image': '/src/assets/images/product_cashmere_knit_1794992374810.jpg',
        'stock': 31,
        'rating': 4.9,
    },
    {
        'name': 'Womenswear Tailored Silk Poplin Blouse',
        'description': 'Refined womenswear shirt tailored with curved French cuffs and sculpted waist darts.',
        'category': "Women's Clothing",
        'brand': 'StyleFusion AI',
        'price': 210.0,
        'discount_price': None,
        'sizes': ['XS', 'S', 'M', 'L'],
        'colors': ['Ivory', 'White'],
        'image': '/src/assets/images/product_silk_shirt_1794992373173.jpg',
        'stock': 27,
        'rating': 4.6,
    },
]


def seed_database():
    app = create_app()
    with app.app_context():
        if User.query.count() == 0:
            admin = User(
                name='Atelier Admin',
                email='admin@ateliervera.com',
                phone='+1 (555) 210-8900',
                address='42 Mercer Street, New York, NY 10013',
                role='admin',
            )
            admin.set_password('Admin@1234')

            customer = User(
                name='Claire Laurent',
                email='claire@ateliervera.com',
                phone='+1 (555) 834-1290',
                address='718 Abbot Kinney Blvd, Venice, CA 90291',
                role='customer',
            )
            customer.set_password('Customer@1234')
            db.session.add_all([admin, customer])
            db.session.commit()

        if Product.query.count() == 0:
            for p in SEEDED_PRODUCTS:
                db.session.add(
                    Product(
                        name=p['name'],
                        description=p['description'],
                        category=p['category'],
                        brand=p['brand'],
                        price=p['price'],
                        discount_price=p['discount_price'],
                        sizes=json.dumps(p['sizes']),
                        colors=json.dumps(p['colors']),
                        image=p['image'],
                        stock=p['stock'],
                        rating=p['rating'],
                    )
                )
            db.session.commit()

            customer = User.query.filter_by(email='claire@ateliervera.com').first()
            first_product = Product.query.first()
            if customer and first_product:
                db.session.add(
                    Review(
                        user_id=customer.id,
                        product_id=first_product.id,
                        rating=5,
                        review_text='Exceptional wool weight and shoulder line. Virtual Try-On fit matched size M accurately.',
                    )
                )
                db.session.commit()

        print(f'Seeded {User.query.count()} users and {Product.query.count()} products into SQLite.')


if __name__ == '__main__':
    seed_database()
