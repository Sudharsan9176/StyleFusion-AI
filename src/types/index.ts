export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: 'customer' | 'admin' | string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  category: string;
  brand: string;
  price: number;
  discount_price: number | null;
  sizes: string[];
  colors: string[];
  image: string;
  stock: number;
  rating: number;
  created_at: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CartItem {
  id: number;
  product_id: number;
  quantity: number;
  selected_size: string;
  selected_color: string;
  product: {
    id: number;
    name: string;
    brand: string;
    category: string;
    price: number;
    discount_price: number | null;
    image: string;
    stock: number;
    sizes: string[];
    colors: string[];
  };
}

export interface CartSummary {
  item_count: number;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

export interface WishlistItem {
  id: number;
  saved_at: string;
  product: Product;
}

export interface Review {
  id: number;
  user_id: number;
  product_id: number;
  rating: number;
  review_text: string;
  created_at: string;
  user_name: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  size: string;
  color: string;
  price: number;
  product_name: string;
  product_image: string;
  product_brand?: string;
}

export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  shipping_address: string;
  payment_method: string;
  payment_status: string;
  order_status: 'Pending' | 'Confirmed' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled' | string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  items: OrderItem[];
}

export interface TryOnSession {
  id: number;
  user_id: number;
  product_id: number;
  original_image_path: string;
  generated_image_path: string | null;
  model_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  error_message: string | null;
  created_at: string;
  product_name?: string;
  product_image?: string;
  product_category?: string;
  product_price?: number;
  product_discount_price?: number | null;
  user_name?: string;
}

export interface AdminDashboardData {
  kpis: {
    total_revenue: number;
    total_orders: number;
    pending_orders: number;
    total_customers: number;
    total_products: number;
    total_stock: number;
    low_stock_count: number;
    total_tryons: number;
    completed_tryons: number;
    failed_tryons: number;
  };
  category_breakdown: Array<{
    category: string;
    product_count: number;
    stock_count: number;
    revenue: number;
  }>;
  order_status_breakdown: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  recent_tryons: TryOnSession[];
}

export interface AdminCustomer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  created_at: string;
  order_count: number;
  total_spent: number;
}
