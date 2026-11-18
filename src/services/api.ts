import axios from 'axios';
import type {
  AdminCustomer,
  AdminDashboardData,
  CartItem,
  CartSummary,
  Order,
  Pagination,
  Product,
  Review,
  TryOnSession,
  User,
  WishlistItem,
} from '../types';

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 130000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('atelier_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; message?: string } | undefined;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// Auth API
export const authApi = {
  register: (payload: { name: string; email: string; password: string; phone?: string; address?: string }) =>
    apiClient.post<{ token: string; user: User }>('/auth/register', payload).then((r) => r.data),
  login: (payload: { email: string; password: string }) =>
    apiClient.post<{ token: string; user: User }>('/auth/login', payload).then((r) => r.data),
  getProfile: () => apiClient.get<{ user: User }>('/auth/profile').then((r) => r.data),
  updateProfile: (payload: {
    name?: string;
    phone?: string;
    address?: string;
    current_password?: string;
    new_password?: string;
  }) => apiClient.put<{ user: User }>('/auth/profile', payload).then((r) => r.data),
};

// Products API
export const productsApi = {
  list: (params?: {
    search?: string;
    category?: string;
    size?: string;
    color?: string;
    min_price?: string | number;
    max_price?: string | number;
    sort?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient
      .get<{ products: Product[]; pagination: Pagination }>('/products', { params })
      .then((r) => r.data),
  getById: (id: number | string) =>
    apiClient.get<{ product: Product; reviews: Review[] }>(`/products/${id}`).then((r) => r.data),
  getCategories: () =>
    apiClient.get<{ categories: Array<{ category: string; count: number }> }>('/categories').then((r) => r.data),
  getReviews: (productId: number | string) =>
    apiClient.get<{ reviews: Review[] }>(`/products/${productId}/reviews`).then((r) => r.data),
  addReview: (payload: { product_id: number; rating: number; review_text: string }) =>
    apiClient.post<{ review: Review; updated_rating: number }>('/reviews', payload).then((r) => r.data),
};

// Cart API
export const cartApi = {
  get: () => apiClient.get<{ items: CartItem[]; summary: CartSummary }>('/cart').then((r) => r.data),
  add: (payload: { product_id: number; quantity?: number; selected_size: string; selected_color: string }) =>
    apiClient.post<{ items: CartItem[]; summary: CartSummary }>('/cart', payload).then((r) => r.data),
  update: (id: number, payload: { quantity?: number; selected_size?: string; selected_color?: string }) =>
    apiClient.put<{ items: CartItem[]; summary: CartSummary }>(`/cart/${id}`, payload).then((r) => r.data),
  remove: (id: number) =>
    apiClient.delete<{ items: CartItem[]; summary: CartSummary }>(`/cart/${id}`).then((r) => r.data),
};

// Wishlist API
export const wishlistApi = {
  get: () => apiClient.get<{ items: WishlistItem[] }>('/wishlist').then((r) => r.data),
  add: (productId: number) => apiClient.post('/wishlist', { product_id: productId }).then((r) => r.data),
  remove: (productId: number) => apiClient.delete(`/wishlist/${productId}`).then((r) => r.data),
};

// Virtual Try-On API
export const tryOnApi = {
  generate: (formData: FormData) =>
    apiClient
      .post<{ session: TryOnSession }>('/tryon/generate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  history: () => apiClient.get<{ sessions: TryOnSession[] }>('/tryon/history').then((r) => r.data),
  getById: (id: number) => apiClient.get<{ session: TryOnSession }>(`/tryon/${id}`).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/tryon/${id}`).then((r) => r.data),
};

// Orders API
export const ordersApi = {
  create: (payload: { shipping_address: string; payment_method: string; card_last4?: string }) =>
    apiClient.post<{ order: Order }>('/orders', payload).then((r) => r.data),
  list: () => apiClient.get<{ orders: Order[] }>('/orders').then((r) => r.data),
  getById: (id: number | string) => apiClient.get<{ order: Order }>(`/orders/${id}`).then((r) => r.data),
  cancel: (id: number) => apiClient.post<{ order: Order }>(`/orders/${id}/cancel`).then((r) => r.data),
};

// Admin API
export const adminApi = {
  dashboard: () => apiClient.get<AdminDashboardData>('/admin/dashboard').then((r) => r.data),
  orders: () => apiClient.get<{ orders: Order[] }>('/admin/orders').then((r) => r.data),
  updateOrder: (id: number, payload: { order_status?: string; payment_status?: string }) =>
    apiClient.put<{ order: Order }>(`/admin/orders/${id}`, payload).then((r) => r.data),
  customers: () => apiClient.get<{ customers: AdminCustomer[] }>('/admin/customers').then((r) => r.data),
  createProduct: (formData: FormData) =>
    apiClient
      .post<{ product: Product }>('/admin/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  updateProduct: (id: number, formData: FormData) =>
    apiClient
      .put<{ product: Product }>(`/admin/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data),
  deleteProduct: (id: number) => apiClient.delete(`/admin/products/${id}`).then((r) => r.data),
};
