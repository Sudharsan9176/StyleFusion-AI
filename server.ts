import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initDatabase,
  serializeProduct,
  ROOT_DIR,
  UPLOAD_DIR,
  USER_PHOTOS_DIR,
  PRODUCT_UPLOADS_DIR,
  GENERATED_DIR,
} from './server/db.ts';
import { runVirtualTryOn, HuggingFaceTryOnError } from './server/huggingface.ts';

initDatabase();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET_KEY || process.env.SECRET_KEY || 'atelier_vera_dev_jwt_secret';

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static serving for uploaded photos, products, and AI generated images
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/generated', express.static(GENERATED_DIR));

interface AuthUser {
  id: number;
  email: string;
  role: string;
  name: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

function generateToken(user: AuthUser): string {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    const dbUser = db.prepare('SELECT id, email, role, name FROM users WHERE id = ?').get(decoded.id) as
      | AuthUser
      | undefined;
    if (!dbUser) {
      res.status(401).json({ error: 'User account no longer exists.' });
      return;
    }
    req.user = dbUser;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator access required.' });
      return;
    }
    next();
  });
}

// Multer storage configurations
const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.mimetype)) {
    cb(new Error('Only JPG, JPEG, PNG, and WEBP image files are supported.'));
    return;
  }
  cb(null, true);
};

const userPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, USER_PHOTOS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `person_${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});

const productImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, PRODUCT_UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `product_${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, phone = '', address = '' } = req.body as Record<string, string>;
  if (!name || !name.trim() || !email || !email.trim() || !password) {
    res.status(400).json({ error: 'Name, email, and password are required.' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, phone, address, role)
       VALUES (?, ?, ?, ?, ?, 'customer')`
    )
    .run(name.trim(), normalizedEmail, passwordHash, phone.trim(), address.trim());

  const user = db
    .prepare('SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as unknown as AuthUser & {
    phone: string;
    address: string;
    created_at: string;
  };

  const token = generateToken(user);
  res.status(201).json({ token, user });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body as Record<string, string>;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as
    | (AuthUser & { password_hash: string; phone: string; address: string; created_at: string })
    | undefined;

  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const user = {
    id: userRow.id,
    name: userRow.name,
    email: userRow.email,
    phone: userRow.phone,
    address: userRow.address,
    role: userRow.role,
    created_at: userRow.created_at,
  };
  const token = generateToken(user);
  res.json({ token, user });
});

app.get('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = db
    .prepare('SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ?')
    .get(req.user!.id);
  res.json({ user });
});

app.put('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name, phone, address, current_password, new_password } = req.body as Record<string, string>;
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as Record<string, unknown>;

  if (new_password) {
    if (!current_password || !bcrypt.compareSync(current_password, String(existing.password_hash))) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (new_password.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    const newHash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user!.id);
  }

  db.prepare('UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?').run(
    name?.trim() || String(existing.name),
    phone !== undefined ? phone.trim() : String(existing.phone || ''),
    address !== undefined ? address.trim() : String(existing.address || ''),
    req.user!.id
  );

  const updated = db
    .prepare('SELECT id, name, email, phone, address, role, created_at FROM users WHERE id = ?')
    .get(req.user!.id);
  res.json({ user: updated });
});

// ==================== PRODUCT ROUTES ====================

app.get('/api/categories', (_req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY category ASC')
    .all() as Array<{ category: string; count: number }>;
  res.json({ categories: rows });
});

app.get('/api/products', (req: Request, res: Response) => {
  const {
    search = '',
    category = '',
    size = '',
    color = '',
    min_price,
    max_price,
    sort = 'newest',
    page = '1',
    limit = '12',
  } = req.query as Record<string, string>;

  const whereClauses: string[] = [];
  const params: Array<string | number> = [];

  if (search.trim()) {
    whereClauses.push('(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(category) LIKE ?)');
    const q = `%${search.trim().toLowerCase()}%`;
    params.push(q, q, q, q);
  }

  if (category.trim() && category.toLowerCase() !== 'all') {
    whereClauses.push('LOWER(category) = ?');
    params.push(category.trim().toLowerCase());
  }

  if (size.trim()) {
    whereClauses.push('sizes LIKE ?');
    params.push(`%"${size.trim()}"%`);
  }

  if (color.trim()) {
    whereClauses.push('LOWER(colors) LIKE ?');
    params.push(`%"${color.trim().toLowerCase()}"%`);
  }

  if (min_price !== undefined && min_price !== '') {
    whereClauses.push('COALESCE(discount_price, price) >= ?');
    params.push(Number(min_price));
  }

  if (max_price !== undefined && max_price !== '') {
    whereClauses.push('COALESCE(discount_price, price) <= ?');
    params.push(Number(max_price));
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let orderBy = 'created_at DESC, id DESC';
  if (sort === 'price_asc') orderBy = 'COALESCE(discount_price, price) ASC';
  else if (sort === 'price_desc') orderBy = 'COALESCE(discount_price, price) DESC';
  else if (sort === 'rating') orderBy = 'rating DESC, id DESC';

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));
  const offset = (pageNum - 1) * limitNum;

  const totalRow = db
    .prepare(`SELECT COUNT(*) as total FROM products ${whereSql}`)
    .get(...params) as { total: number };

  const rows = db
    .prepare(`SELECT * FROM products ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...params, limitNum, offset) as Array<Record<string, unknown>>;

  res.json({
    products: rows.map(serializeProduct),
    pagination: {
      total: totalRow.total,
      page: pageNum,
      limit: limitNum,
      pages: Math.max(1, Math.ceil(totalRow.total / limitNum)),
    },
  });
});

app.get('/api/products/:id', (req: Request, res: Response) => {
  const productRow = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id)) as
    | Record<string, unknown>
    | undefined;
  if (!productRow) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  const reviews = db
    .prepare(
      `SELECT r.id, r.user_id, r.product_id, r.rating, r.review_text, r.created_at, u.name as user_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(Number(req.params.id));

  res.json({
    product: serializeProduct(productRow),
    reviews,
  });
});

// ==================== CART ROUTES ====================

function getUserCart(userId: number) {
  const rows = db
    .prepare(
      `SELECT c.id, c.user_id, c.product_id, c.quantity, c.selected_size, c.selected_color,
              p.name, p.brand, p.category, p.price, p.discount_price, p.image, p.stock, p.sizes, p.colors
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?
       ORDER BY c.id DESC`
    )
    .all(userId) as Array<Record<string, unknown>>;

  let subtotal = 0;
  let discountTotal = 0;
  const items = rows.map((row) => {
    const qty = Number(row.quantity);
    const regular = Number(row.price);
    const effective = row.discount_price !== null ? Number(row.discount_price) : regular;
    subtotal += regular * qty;
    discountTotal += (regular - effective) * qty;
    return {
      id: Number(row.id),
      product_id: Number(row.product_id),
      quantity: qty,
      selected_size: String(row.selected_size),
      selected_color: String(row.selected_color),
      product: {
        id: Number(row.product_id),
        name: String(row.name),
        brand: String(row.brand),
        category: String(row.category),
        price: regular,
        discount_price: row.discount_price !== null ? Number(row.discount_price) : null,
        image: String(row.image),
        stock: Number(row.stock),
        sizes: JSON.parse(String(row.sizes)),
        colors: JSON.parse(String(row.colors)),
      },
    };
  });

  const discountedSubtotal = subtotal - discountTotal;
  const shipping = items.length === 0 ? 0 : discountedSubtotal >= 250 ? 0 : 15;
  const total = discountedSubtotal + shipping;

  return {
    items,
    summary: {
      item_count: items.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: Number(subtotal.toFixed(2)),
      discount: Number(discountTotal.toFixed(2)),
      shipping: Number(shipping.toFixed(2)),
      total: Number(total.toFixed(2)),
    },
  };
}

app.get('/api/cart', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json(getUserCart(req.user!.id));
});

app.post('/api/cart', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { product_id, quantity = 1, selected_size, selected_color } = req.body as Record<string, unknown>;
  const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(product_id)) as
    | Record<string, unknown>
    | undefined;
  if (!prod) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  const serialized = serializeProduct(prod);
  if (serialized.stock <= 0) {
    res.status(400).json({ error: 'This item is currently out of stock.' });
    return;
  }

  const size = String(selected_size || serialized.sizes[0] || 'M');
  const color = String(selected_color || serialized.colors[0] || 'Black');
  const qty = Math.max(1, Number(quantity) || 1);

  const existing = db
    .prepare(
      `SELECT id, quantity FROM cart_items
       WHERE user_id = ? AND product_id = ? AND selected_size = ? AND selected_color = ?`
    )
    .get(req.user!.id, serialized.id, size, color) as { id: number; quantity: number } | undefined;

  if (existing) {
    const nextQty = Math.min(serialized.stock, existing.quantity + qty);
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(nextQty, existing.id);
  } else {
    db.prepare(
      `INSERT INTO cart_items (user_id, product_id, quantity, selected_size, selected_color)
       VALUES (?, ?, ?, ?, ?)`
    ).run(req.user!.id, serialized.id, Math.min(serialized.stock, qty), size, color);
  }

  res.status(201).json(getUserCart(req.user!.id));
});

app.put('/api/cart/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const cartId = Number(req.params.id);
  const existing = db
    .prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?')
    .get(cartId, req.user!.id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Cart item not found.' });
    return;
  }

  const prod = db.prepare('SELECT stock FROM products WHERE id = ?').get(Number(existing.product_id)) as {
    stock: number;
  };
  const { quantity, selected_size, selected_color } = req.body as Record<string, unknown>;

  if (quantity !== undefined && Number(quantity) <= 0) {
    db.prepare('DELETE FROM cart_items WHERE id = ?').run(cartId);
    res.json(getUserCart(req.user!.id));
    return;
  }

  const nextQty = quantity !== undefined ? Math.min(prod.stock, Math.max(1, Number(quantity))) : Number(existing.quantity);
  const nextSize = selected_size ? String(selected_size) : String(existing.selected_size);
  const nextColor = selected_color ? String(selected_color) : String(existing.selected_color);

  db.prepare('UPDATE cart_items SET quantity = ?, selected_size = ?, selected_color = ? WHERE id = ?').run(
    nextQty,
    nextSize,
    nextColor,
    cartId
  );

  res.json(getUserCart(req.user!.id));
});

app.delete('/api/cart/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const result = db
    .prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?')
    .run(Number(req.params.id), req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Cart item not found.' });
    return;
  }
  res.json(getUserCart(req.user!.id));
});

// ==================== WISHLIST ROUTES ====================

app.get('/api/wishlist', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT w.id as wishlist_id, w.created_at as saved_at, p.*
       FROM wishlist_items w
       JOIN products p ON w.product_id = p.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`
    )
    .all(req.user!.id) as Array<Record<string, unknown>>;

  res.json({
    items: rows.map((row) => ({
      id: Number(row.wishlist_id),
      saved_at: String(row.saved_at),
      product: serializeProduct(row),
    })),
  });
});

app.post('/api/wishlist', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const productId = Number((req.body as Record<string, unknown>).product_id);
  const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!prod) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  db.prepare('INSERT OR IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)').run(
    req.user!.id,
    productId
  );
  res.status(201).json({ message: 'Added to wishlist.', product_id: productId });
});

app.delete('/api/wishlist/:productId', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  db.prepare('DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?').run(
    req.user!.id,
    Number(req.params.productId)
  );
  res.json({ message: 'Removed from wishlist.' });
});

// ==================== VIRTUAL TRY-ON ROUTES ====================

function mapCategoryToTryOn(productCategory: string, explicitCategory?: string): 'upper_body' | 'lower_body' | 'dresses' {
  if (explicitCategory === 'upper_body' || explicitCategory === 'lower_body' || explicitCategory === 'dresses') {
    return explicitCategory;
  }
  const lower = productCategory.toLowerCase();
  if (lower.includes('dress')) return 'dresses';
  if (lower.includes('jean') || lower.includes('pant') || lower.includes('trouser')) return 'lower_body';
  return 'upper_body';
}

app.post(
  '/api/tryon/generate',
  requireAuth,
  userPhotoUpload.single('person_image'),
  async (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as Record<string, string>;
    const productId = Number(body.product_id);
    if (!productId) {
      res.status(400).json({ error: 'Please select a clothing product from the catalog.' });
      return;
    }

    const productRow = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as
      | Record<string, unknown>
      | undefined;
    if (!productRow) {
      res.status(404).json({ error: 'Selected clothing product was not found.' });
      return;
    }
    const product = serializeProduct(productRow);

    let personImageUrlPath = body.existing_person_image_path || '';
    if (req.file) {
      personImageUrlPath = `/uploads/user_photos/${req.file.filename}`;
    }

    if (!personImageUrlPath) {
      res.status(400).json({ error: 'Please upload a photograph of yourself first.' });
      return;
    }

    // Validate the person image exists locally if reusing session photo
    const localPersonDiskPath = path.resolve(ROOT_DIR, 'backend', personImageUrlPath.replace(/^\/+/, ''));
    if (!fs.existsSync(localPersonDiskPath)) {
      res.status(400).json({ error: 'Uploaded user photo could not be located on disk. Please upload again.' });
      return;
    }

    const tryOnCategory = mapCategoryToTryOn(product.category, body.category);
    const modelName = process.env.HF_MODEL_ID?.trim() || 'yisol/IDM-VTON';

    const insertSession = db
      .prepare(
        `INSERT INTO tryon_sessions (user_id, product_id, original_image_path, generated_image_path, model_name, status, error_message)
         VALUES (?, ?, ?, NULL, ?, 'processing', NULL)`
      )
      .run(req.user!.id, product.id, personImageUrlPath, modelName);

    const sessionId = Number(insertSession.lastInsertRowid);

    try {
      const result = await runVirtualTryOn({
        personImagePath: personImageUrlPath,
        garmentImagePathOrUrl: product.image,
        garmentDescription: body.garment_description || `${product.name} - ${product.category}`,
        category: tryOnCategory,
        denoiseSteps: body.denoise_steps ? Number(body.denoise_steps) : 30,
        seed: body.seed ? Number(body.seed) : 42,
      });

      db.prepare(
        `UPDATE tryon_sessions
         SET generated_image_path = ?, model_name = ?, status = 'completed', error_message = NULL
         WHERE id = ?`
      ).run(result.generatedImageUrl, result.modelName, sessionId);

      const session = db
        .prepare(
          `SELECT t.*, p.name as product_name, p.image as product_image, p.price as product_price, p.discount_price as product_discount_price
           FROM tryon_sessions t
           JOIN products p ON t.product_id = p.id
           WHERE t.id = ?`
        )
        .get(sessionId);

      res.status(201).json({ session });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Virtual Try-On inference failed.';
      const statusCode = err instanceof HuggingFaceTryOnError ? err.statusCode : 502;

      db.prepare(
        `UPDATE tryon_sessions SET status = 'failed', error_message = ? WHERE id = ?`
      ).run(message, sessionId);

      res.status(statusCode).json({
        error: message,
        session_id: sessionId,
        original_image_path: personImageUrlPath,
      });
    }
  }
);

app.get('/api/tryon/history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT t.*, p.name as product_name, p.image as product_image, p.category as product_category, p.price as product_price, p.discount_price as product_discount_price
       FROM tryon_sessions t
       JOIN products p ON t.product_id = p.id
       WHERE t.user_id = ?
       ORDER BY t.created_at DESC, t.id DESC`
    )
    .all(req.user!.id);
  res.json({ sessions: rows });
});

app.get('/api/tryon/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const row = db
    .prepare(
      `SELECT t.*, p.name as product_name, p.image as product_image, p.category as product_category
       FROM tryon_sessions t
       JOIN products p ON t.product_id = p.id
       WHERE t.id = ? AND (t.user_id = ? OR ? = 'admin')`
    )
    .get(Number(req.params.id), req.user!.id, req.user!.role);

  if (!row) {
    res.status(404).json({ error: 'Try-on session not found.' });
    return;
  }
  res.json({ session: row });
});

app.delete('/api/tryon/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const existing = db
    .prepare('SELECT * FROM tryon_sessions WHERE id = ? AND user_id = ?')
    .get(Number(req.params.id), req.user!.id) as Record<string, unknown> | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Try-on session not found.' });
    return;
  }

  db.prepare('DELETE FROM tryon_sessions WHERE id = ?').run(Number(req.params.id));
  res.json({ message: 'Try-on session deleted.' });
});

// ==================== ORDER ROUTES ====================

app.post('/api/orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { shipping_address, payment_method = 'Cash on Delivery', card_last4 } = req.body as Record<string, string>;

  if (!shipping_address || shipping_address.trim().length < 8) {
    res.status(400).json({ error: 'Please provide a complete shipping address.' });
    return;
  }

  const allowedMethods = ['Cash on Delivery', 'Test Card Payment'];
  if (!allowedMethods.includes(payment_method)) {
    res.status(400).json({ error: 'Unsupported payment method selected.' });
    return;
  }

  if (payment_method === 'Test Card Payment' && (!card_last4 || card_last4.length !== 4)) {
    res.status(400).json({ error: 'Valid test card details are required.' });
    return;
  }

  const cart = getUserCart(req.user!.id);
  if (cart.items.length === 0) {
    res.status(400).json({ error: 'Your shopping bag is empty.' });
    return;
  }

  // Verify stock before placing order
  for (const item of cart.items) {
    if (item.product.stock < item.quantity) {
      res.status(400).json({
        error: `Insufficient stock for ${item.product.name} (${item.product.stock} remaining).`,
      });
      return;
    }
  }

  const paymentStatus = payment_method === 'Test Card Payment' ? 'Paid (Test Mode)' : 'Pending (COD)';
  const orderStatus = payment_method === 'Test Card Payment' ? 'Confirmed' : 'Pending';

  const insertOrder = db
    .prepare(
      `INSERT INTO orders (user_id, total_amount, shipping_address, payment_method, payment_status, order_status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      cart.summary.total,
      shipping_address.trim(),
      payment_method,
      paymentStatus,
      orderStatus
    );

  const orderId = Number(insertOrder.lastInsertRowid);
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, quantity, size, color, price)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const decrementStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

  for (const item of cart.items) {
    const unitPrice = item.product.discount_price ?? item.product.price;
    insertItem.run(orderId, item.product_id, item.quantity, item.selected_size, item.selected_color, unitPrice);
    decrementStock.run(item.quantity, item.product_id);
  }

  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user!.id);

  const order = getOrderWithItems(orderId, req.user!.id, req.user!.role);
  res.status(201).json({ order });
});

function getOrderWithItems(orderId: number, userId: number, role: string) {
  const order = db
    .prepare(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = ? AND (o.user_id = ? OR ? = 'admin')`
    )
    .get(orderId, userId, role) as Record<string, unknown> | undefined;

  if (!order) return null;

  const items = db
    .prepare(
      `SELECT oi.*, p.name as product_name, p.image as product_image, p.brand as product_brand
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`
    )
    .all(orderId);

  return { ...order, items };
}

app.get('/api/orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orders = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(req.user!.id) as Array<Record<string, unknown>>;

  const enriched = orders.map((order) => {
    const items = db
      .prepare(
        `SELECT oi.*, p.name as product_name, p.image as product_image, p.brand as product_brand
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
      )
      .all(Number(order.id));
    return { ...order, items };
  });

  res.json({ orders: enriched });
});

app.get('/api/orders/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const order = getOrderWithItems(Number(req.params.id), req.user!.id, req.user!.role);
  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }
  res.json({ order });
});

app.post('/api/orders/:id/cancel', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const order = db
    .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
    .get(orderId, req.user!.id) as Record<string, unknown> | undefined;

  if (!order) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  if (!['Pending', 'Confirmed'].includes(String(order.order_status))) {
    res.status(400).json({ error: `Cannot cancel order in "${order.order_status}" stage.` });
    return;
  }

  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId) as Array<{
    product_id: number;
    quantity: number;
  }>;
  const restoreStock = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  for (const item of items) {
    restoreStock.run(item.quantity, item.product_id);
  }

  db.prepare(`UPDATE orders SET order_status = 'Cancelled' WHERE id = ?`).run(orderId);
  const updated = getOrderWithItems(orderId, req.user!.id, req.user!.role);
  res.json({ order: updated });
});

// ==================== REVIEW ROUTES ====================

app.get('/api/products/:id/reviews', (req: Request, res: Response) => {
  const reviews = db
    .prepare(
      `SELECT r.*, u.name as user_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`
    )
    .all(Number(req.params.id));
  res.json({ reviews });
});

app.post('/api/reviews', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { product_id, rating, review_text } = req.body as Record<string, unknown>;
  const prodId = Number(product_id);
  const numRating = Number(rating);

  if (!prodId || !numRating || numRating < 1 || numRating > 5 || !String(review_text || '').trim()) {
    res.status(400).json({ error: 'Product ID, rating (1-5), and review comment are required.' });
    return;
  }

  const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(prodId);
  if (!prod) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }

  const insert = db
    .prepare('INSERT INTO reviews (user_id, product_id, rating, review_text) VALUES (?, ?, ?, ?)')
    .run(req.user!.id, prodId, numRating, String(review_text).trim());

  const avgRow = db
    .prepare('SELECT ROUND(AVG(rating), 1) as avg_rating FROM reviews WHERE product_id = ?')
    .get(prodId) as { avg_rating: number };

  db.prepare('UPDATE products SET rating = ? WHERE id = ?').run(avgRow.avg_rating || numRating, prodId);

  const review = db
    .prepare(
      `SELECT r.*, u.name as user_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = ?`
    )
    .get(Number(insert.lastInsertRowid));

  res.status(201).json({ review, updated_rating: avgRow.avg_rating });
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/dashboard', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const revenueStats = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN order_status != 'Cancelled' THEN total_amount ELSE 0 END), 0) as total_revenue,
         COUNT(*) as total_orders,
         SUM(CASE WHEN order_status = 'Pending' THEN 1 ELSE 0 END) as pending_orders
       FROM orders`
    )
    .get() as Record<string, number>;

  const customerCount = db
    .prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'customer'`)
    .get() as { count: number };

  const productStats = db
    .prepare(
      `SELECT COUNT(*) as total_products, COALESCE(SUM(stock), 0) as total_stock,
              SUM(CASE WHEN stock <= 5 THEN 1 ELSE 0 END) as low_stock_count
       FROM products`
    )
    .get() as Record<string, number>;

  const tryonStats = db
    .prepare(
      `SELECT
         COUNT(*) as total_tryons,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tryons,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tryons
       FROM tryon_sessions`
    )
    .get() as Record<string, number>;

  const categoryBreakdown = db
    .prepare(
      `SELECT p.category, COUNT(p.id) as product_count, COALESCE(SUM(p.stock), 0) as stock_count,
              COALESCE(SUM(oi.quantity * oi.price), 0) as revenue
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       GROUP BY p.category
       ORDER BY revenue DESC, product_count DESC`
    )
    .all();

  const orderStatusBreakdown = db
    .prepare(
      `SELECT order_status as status, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount
       FROM orders
       GROUP BY order_status`
    )
    .all();

  const recentTryons = db
    .prepare(
      `SELECT t.*, u.name as user_name, p.name as product_name
       FROM tryon_sessions t
       JOIN users u ON t.user_id = u.id
       JOIN products p ON t.product_id = p.id
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT 10`
    )
    .all();

  res.json({
    kpis: {
      total_revenue: Number((revenueStats.total_revenue || 0).toFixed(2)),
      total_orders: revenueStats.total_orders || 0,
      pending_orders: revenueStats.pending_orders || 0,
      total_customers: customerCount.count || 0,
      total_products: productStats.total_products || 0,
      total_stock: productStats.total_stock || 0,
      low_stock_count: productStats.low_stock_count || 0,
      total_tryons: tryonStats.total_tryons || 0,
      completed_tryons: tryonStats.completed_tryons || 0,
      failed_tryons: tryonStats.failed_tryons || 0,
    },
    category_breakdown: categoryBreakdown,
    order_status_breakdown: orderStatusBreakdown,
    recent_tryons: recentTryons,
  });
});

app.post(
  '/api/admin/products',
  requireAdmin,
  productImageUpload.single('image_file'),
  (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as Record<string, string>;
    const { name, description, category, brand, price, discount_price, sizes, colors, stock, image } = body;

    if (!name || !description || !category || !brand || !price) {
      res.status(400).json({ error: 'Name, description, category, brand, and price are required.' });
      return;
    }

    const imageUrl = req.file ? `/uploads/products/${req.file.filename}` : image?.trim();
    if (!imageUrl) {
      res.status(400).json({ error: 'Please upload a product image or provide an image path.' });
      return;
    }

    const parsedSizes = parseCommaOrJsonArray(sizes, ['S', 'M', 'L', 'XL']);
    const parsedColors = parseCommaOrJsonArray(colors, ['Black']);

    const insert = db
      .prepare(
        `INSERT INTO products (name, description, category, brand, price, discount_price, sizes, colors, image, stock, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0)`
      )
      .run(
        name.trim(),
        description.trim(),
        category.trim(),
        brand.trim(),
        Number(price),
        discount_price ? Number(discount_price) : null,
        JSON.stringify(parsedSizes),
        JSON.stringify(parsedColors),
        imageUrl,
        Number(stock || 0)
      );

    const created = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(Number(insert.lastInsertRowid)) as Record<string, unknown>;
    res.status(201).json({ product: serializeProduct(created) });
  }
);

app.put(
  '/api/admin/products/:id',
  requireAdmin,
  productImageUpload.single('image_file'),
  (req: AuthenticatedRequest, res: Response) => {
    const productId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as
      | Record<string, unknown>
      | undefined;

    if (!existing) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const body = req.body as Record<string, string>;
    const imageUrl = req.file
      ? `/uploads/products/${req.file.filename}`
      : body.image?.trim() || String(existing.image);

    const parsedSizes =
      body.sizes !== undefined ? parseCommaOrJsonArray(body.sizes, ['S', 'M', 'L']) : JSON.parse(String(existing.sizes));
    const parsedColors =
      body.colors !== undefined ? parseCommaOrJsonArray(body.colors, ['Black']) : JSON.parse(String(existing.colors));

    db.prepare(
      `UPDATE products
       SET name = ?, description = ?, category = ?, brand = ?, price = ?, discount_price = ?, sizes = ?, colors = ?, image = ?, stock = ?
       WHERE id = ?`
    ).run(
      body.name?.trim() || String(existing.name),
      body.description?.trim() || String(existing.description),
      body.category?.trim() || String(existing.category),
      body.brand?.trim() || String(existing.brand),
      body.price !== undefined ? Number(body.price) : Number(existing.price),
      body.discount_price !== undefined
        ? body.discount_price === '' || body.discount_price === 'null'
          ? null
          : Number(body.discount_price)
        : existing.discount_price !== null && existing.discount_price !== undefined
        ? Number(existing.discount_price)
        : null,
      JSON.stringify(parsedSizes),
      JSON.stringify(parsedColors),
      imageUrl,
      body.stock !== undefined ? Number(body.stock) : Number(existing.stock),
      productId
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Record<string, unknown>;
    res.json({ product: serializeProduct(updated) });
  }
);

app.delete('/api/admin/products/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const result = db.prepare('DELETE FROM products WHERE id = ?').run(Number(req.params.id));
  if (result.changes === 0) {
    res.status(404).json({ error: 'Product not found.' });
    return;
  }
  res.json({ message: 'Product deleted successfully.' });
});

app.get('/api/admin/orders', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const orders = db
    .prepare(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC, o.id DESC`
    )
    .all() as Array<Record<string, unknown>>;

  const enriched = orders.map((order) => {
    const items = db
      .prepare(
        `SELECT oi.*, p.name as product_name, p.image as product_image
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`
      )
      .all(Number(order.id));
    return { ...order, items };
  });

  res.json({ orders: enriched });
});

app.put('/api/admin/orders/:id', requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const orderId = Number(req.params.id);
  const { order_status, payment_status } = req.body as Record<string, string>;
  const allowedStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

  if (order_status && !allowedStatuses.includes(order_status)) {
    res.status(400).json({ error: 'Invalid order status.' });
    return;
  }

  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Order not found.' });
    return;
  }

  db.prepare('UPDATE orders SET order_status = ?, payment_status = ? WHERE id = ?').run(
    order_status || String(existing.order_status),
    payment_status || String(existing.payment_status),
    orderId
  );

  const updated = getOrderWithItems(orderId, req.user!.id, 'admin');
  res.json({ order: updated });
});

app.get('/api/admin/customers', requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
  const customers = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.address, u.role, u.created_at,
              COUNT(o.id) as order_count,
              COALESCE(SUM(CASE WHEN o.order_status != 'Cancelled' THEN o.total_amount ELSE 0 END), 0) as total_spent
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json({ customers });
});

function parseCommaOrJsonArray(val: string | undefined, fallback: string[]): string[] {
  if (!val) return fallback;
  const trimmed = val.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
    } catch {
      // fall through to comma split
    }
  }
  const split = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return split.length ? split : fallback;
}

// Multer & global API error handler
app.use('/api', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: err.message || 'Invalid API request.' });
});

// ==================== VITE / STATIC FRONTEND ====================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atelier Vera server listening on http://localhost:${PORT}`);
  });
}

startServer();
