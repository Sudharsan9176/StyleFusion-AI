import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';

export const ROOT_DIR = process.cwd();
export const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
export const INSTANCE_DIR = path.join(BACKEND_DIR, 'instance');
export const UPLOAD_DIR = path.join(BACKEND_DIR, process.env.UPLOAD_FOLDER || 'uploads');
export const USER_PHOTOS_DIR = path.join(UPLOAD_DIR, 'user_photos');
export const PRODUCT_UPLOADS_DIR = path.join(UPLOAD_DIR, 'products');
export const GENERATED_DIR = path.join(BACKEND_DIR, process.env.GENERATED_FOLDER || 'generated');
export const TRYON_OUTPUT_DIR = path.join(GENERATED_DIR, 'tryon_images');
export const DB_PATH = path.join(INSTANCE_DIR, 'fashion_store.db');

for (const dir of [
  INSTANCE_DIR,
  UPLOAD_DIR,
  USER_PHOTOS_DIR,
  PRODUCT_UPLOADS_DIR,
  GENERATED_DIR,
  TRYON_OUTPUT_DIR,
]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      role TEXT NOT NULL DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT NOT NULL,
      price REAL NOT NULL,
      discount_price REAL,
      sizes TEXT NOT NULL DEFAULT '["S","M","L","XL"]',
      colors TEXT NOT NULL DEFAULT '["Black"]',
      image TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      rating REAL NOT NULL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      selected_size TEXT NOT NULL,
      selected_color TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);

    CREATE TABLE IF NOT EXISTS wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist_items(user_id);

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      shipping_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'Pending',
      order_status TEXT NOT NULL DEFAULT 'Pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      size TEXT NOT NULL,
      color TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      review_text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

    CREATE TABLE IF NOT EXISTS tryon_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      original_image_path TEXT NOT NULL,
      generated_image_path TEXT,
      model_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tryon_user ON tryon_sessions(user_id);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const adminHash = bcrypt.hashSync('Admin@1234', 10);
    const customerHash = bcrypt.hashSync('Customer@1234', 10);

    db.prepare(
      `INSERT INTO users (name, email, password_hash, phone, address, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      'Atelier Admin',
      'admin@ateliervera.com',
      adminHash,
      '+1 (555) 210-8900',
      '42 Mercer Street, Suite 4B, New York, NY 10013',
      'admin'
    );

    db.prepare(
      `INSERT INTO users (name, email, password_hash, phone, address, role)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      'Claire Laurent',
      'claire@ateliervera.com',
      customerHash,
      '+1 (555) 834-1290',
      '718 Abbot Kinney Blvd, Venice, CA 90291',
      'customer'
    );
  }

  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (productCount.count === 0) {
    const seededProducts = [
      {
        name: 'Double-Breasted Wool Overcoat',
        description:
          'Tailored from heavyweight Italian virgin wool with structured peak lapels, horn buttons, and full cupro lining. Designed for crisp autumn and winter layering.',
        category: 'Jackets',
        brand: 'Atelier Vera',
        price: 490.0,
        discount_price: 420.0,
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['Black', 'Charcoal']),
        image: '/src/assets/images/product_wool_overcoat_1794992372142.jpg',
        stock: 18,
        rating: 4.9,
      },
      {
        name: 'Mulberry Silk Atelier Shirt',
        description:
          'Cut from 22-momme organic mulberry silk with mother-of-pearl buttons, clean French placket, and fluid drape for formal or smart-casual styling.',
        category: 'Shirts',
        brand: 'Atelier Vera',
        price: 220.0,
        discount_price: 185.0,
        sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['Ivory', 'White']),
        image: '/src/assets/images/product_silk_shirt_1794992373173.jpg',
        stock: 34,
        rating: 4.8,
      },
      {
        name: 'Charcoal Linen-Wool Formal Blazer',
        description:
          'Half-canvas tailored blazer crafted from breathable Belgian linen and fine merino wool. Features notched lapels, welt chest pocket, and horn cuffs.',
        category: 'Formal Wear',
        brand: 'Maison Nord',
        price: 380.0,
        discount_price: null,
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['Charcoal', 'Slate']),
        image: '/src/assets/images/product_linen_blazer_1794992372231.jpg',
        stock: 14,
        rating: 4.7,
      },
      {
        name: 'Heavyweight Combed Cotton Tee',
        description:
          '310gsm organic combed cotton jersey t-shirt with a structured mock-rib collar and boxy modern silhouette built to hold its shape wash after wash.',
        category: 'T-Shirts',
        brand: 'Vera Basics',
        price: 68.0,
        discount_price: 54.0,
        sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['White', 'Black']),
        image: '/src/assets/images/product_ribbed_tee_1794992372654.jpg',
        stock: 65,
        rating: 4.8,
      },
      {
        name: 'Pleated A-Line Midi Dress',
        description:
          'Architectural sleeveless midi dress in matte Japanese crepe featuring knife-pleated bodice paneling, defined waist seam, and fluid full-length skirt.',
        category: 'Dresses',
        brand: 'Atelier Vera',
        price: 340.0,
        discount_price: 295.0,
        sizes: JSON.stringify(['XS', 'S', 'M', 'L']),
        colors: JSON.stringify(['Black']),
        image: '/src/assets/images/product_midi_dress_1794992373277.jpg',
        stock: 22,
        rating: 4.9,
      },
      {
        name: 'Japanese Selvedge Straight Jeans',
        description:
          '14oz rope-dyed indigo selvedge denim woven on vintage shuttle looms in Okayama. Classic mid-rise straight fit with contrast tobacco stitching.',
        category: 'Jeans',
        brand: 'Kuro Denim',
        price: 260.0,
        discount_price: null,
        sizes: JSON.stringify(['28', '30', '32', '34', '36']),
        colors: JSON.stringify(['Indigo']),
        image: '/src/assets/images/product_selvedge_jeans_1794992373960.jpg',
        stock: 29,
        rating: 4.7,
      },
      {
        name: 'Full-Grain Calfskin Moto Jacket',
        description:
          'Supple vegetable-tanned Italian calfskin biker jacket with brushed silver hardware, belted hem, and articulated sleeves for effortless movement.',
        category: "Men's Clothing",
        brand: 'Maison Nord',
        price: 680.0,
        discount_price: 590.0,
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['Black']),
        image: '/src/assets/images/product_leather_jacket_1794992374584.jpg',
        stock: 9,
        rating: 5.0,
      },
      {
        name: 'Handloom Silk Mandarin Kurta',
        description:
          'Artisanal tussar-silk ethnic kurta featuring tonal Chikankari placket embroidery, breathable straight cut, and side vents for festive occasions.',
        category: 'Ethnic Wear',
        brand: 'Vastra Heritage',
        price: 195.0,
        discount_price: 165.0,
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['Ivory', 'Sand']),
        image: '/src/assets/images/product_ethnic_kurta_1794992375375.jpg',
        stock: 25,
        rating: 4.8,
      },
      {
        name: 'Mongolian Cashmere Turtleneck',
        description:
          'Fine 12-gauge Grade-A Mongolian cashmere knit sweater with ribbed fold-over collar and relaxed shoulder seams for effortless everyday warmth.',
        category: 'Casual Wear',
        brand: 'Atelier Vera',
        price: 290.0,
        discount_price: 245.0,
        sizes: JSON.stringify(['XS', 'S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['Slate', 'Charcoal']),
        image: '/src/assets/images/product_cashmere_knit_1794992374810.jpg',
        stock: 31,
        rating: 4.9,
      },
      {
        name: 'Womenswear Tailored Silk Poplin Blouse',
        description:
          'Refined womenswear shirt tailored with curved French cuffs, sculpted waist darts, and luminous silk-cotton poplin finish.',
        category: "Women's Clothing",
        brand: 'Atelier Vera',
        price: 210.0,
        discount_price: null,
        sizes: JSON.stringify(['XS', 'S', 'M', 'L']),
        colors: JSON.stringify(['Ivory', 'White']),
        image: '/src/assets/images/product_silk_shirt_1794992373173.jpg',
        stock: 27,
        rating: 4.6,
      },
      {
        name: 'Minimalist Wool Trench Coat',
        description:
          'Longline tailored womenswear overcoat engineered from double-faced virgin wool for clean drape over evening dresses or suiting.',
        category: "Women's Clothing",
        brand: 'Atelier Vera',
        price: 510.0,
        discount_price: 450.0,
        sizes: JSON.stringify(['XS', 'S', 'M', 'L']),
        colors: JSON.stringify(['Black']),
        image: '/src/assets/images/product_wool_overcoat_1794992372142.jpg',
        stock: 12,
        rating: 4.8,
      },
      {
        name: 'Essential Studio Crewneck Pack',
        description:
          'Everyday luxury menswear crewneck crafted in breathable long-staple cotton with zero-torque side seams and clean matte finish.',
        category: "Men's Clothing",
        brand: 'Vera Basics',
        price: 85.0,
        discount_price: 72.0,
        sizes: JSON.stringify(['S', 'M', 'L', 'XL']),
        colors: JSON.stringify(['White', 'Slate']),
        image: '/src/assets/images/product_ribbed_tee_1794992372654.jpg',
        stock: 48,
        rating: 4.7,
      },
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (name, description, category, brand, price, discount_price, sizes, colors, image, stock, rating)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of seededProducts) {
      insertProduct.run(
        p.name,
        p.description,
        p.category,
        p.brand,
        p.price,
        p.discount_price,
        p.sizes,
        p.colors,
        p.image,
        p.stock,
        p.rating
      );
    }

    // Seed initial reviews from Claire so product detail pages show authentic reviews
    const customer = db.prepare('SELECT id FROM users WHERE email = ?').get('claire@ateliervera.com') as
      | { id: number }
      | undefined;
    if (customer) {
      const insertReview = db.prepare(
        `INSERT INTO reviews (user_id, product_id, rating, review_text) VALUES (?, ?, ?, ?)`
      );
      insertReview.run(
        customer.id,
        1,
        5,
        'Exceptional wool weight and shoulder line. Used the Virtual Try-On before ordering M and the fit was spot on.'
      );
      insertReview.run(
        customer.id,
        2,
        5,
        'Lustrous mulberry silk with zero transparency. Pairs seamlessly under tailored blazers.'
      );
      insertReview.run(
        customer.id,
        5,
        5,
        'The knife pleats hold their crisp geometry all evening. True to size.'
      );
    }
  }
}

export function serializeProduct(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description),
    category: String(row.category),
    brand: String(row.brand),
    price: Number(row.price),
    discount_price: row.discount_price !== null && row.discount_price !== undefined ? Number(row.discount_price) : null,
    sizes: safeJsonParse<string[]>(row.sizes as string, ['S', 'M', 'L']),
    colors: safeJsonParse<string[]>(row.colors as string, ['Black']),
    image: String(row.image),
    stock: Number(row.stock),
    rating: Number(row.rating),
    created_at: String(row.created_at),
  };
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
