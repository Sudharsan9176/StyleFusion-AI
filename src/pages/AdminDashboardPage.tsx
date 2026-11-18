import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Box,
  Edit3,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AdminCustomer, AdminDashboardData, Order, Product } from '../types';
import { adminApi, extractErrorMessage, productsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { SafeImage } from '../components/SafeImage';

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const CATEGORIES = [
  "Men's Clothing",
  "Women's Clothing",
  'Shirts',
  'T-Shirts',
  'Dresses',
  'Jeans',
  'Jackets',
  'Ethnic Wear',
  'Casual Wear',
  'Formal Wear',
];

export function AdminDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useStore();

  const [tab, setTab] = useState<'overview' | 'products' | 'orders' | 'customers'>('overview');
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');

  // Product modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formBrand, setFormBrand] = useState('Atelier Vera');
  const [formCategory, setFormCategory] = useState('Jackets');
  const [formPrice, setFormPrice] = useState('');
  const [formDiscount, setFormDiscount] = useState('');
  const [formStock, setFormStock] = useState('20');
  const [formSizes, setFormSizes] = useState('S, M, L, XL');
  const [formColors, setFormColors] = useState('Black, Ivory');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);

  const loadAll = useCallback(async () => {
    if (!user || user.role !== 'admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [dashData, prodData, orderData, custData] = await Promise.all([
        adminApi.dashboard(),
        productsApi.list({ limit: 50 }),
        adminApi.orders(),
        adminApi.customers(),
      ]);
      setDashboard(dashData);
      setProducts(prodData.products);
      setOrders(orderData.orders);
      setCustomers(custData.customers);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load admin metrics.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="font-editorial text-3xl font-semibold text-zinc-950">Administrator Access Required</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Sign in with an administrator account to manage inventory, orders, and analytics.
        </p>
        <Link to="/login" className="mt-6 inline-block px-6 py-3 bg-zinc-950 text-white text-xs font-semibold">
          Go to Sign In
        </Link>
      </div>
    );
  }

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormBrand('Atelier Vera');
    setFormCategory('Jackets');
    setFormPrice('');
    setFormDiscount('');
    setFormStock('20');
    setFormSizes('S, M, L, XL');
    setFormColors('Black');
    setFormDescription('');
    setFormImageUrl('/src/assets/images/product_wool_overcoat_1794992372142.jpg');
    setFormImageFile(null);
    setModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormBrand(p.brand);
    setFormCategory(p.category);
    setFormPrice(String(p.price));
    setFormDiscount(p.discount_price !== null ? String(p.discount_price) : '');
    setFormStock(String(p.stock));
    setFormSizes(p.sizes.join(', '));
    setFormColors(p.colors.join(', '));
    setFormDescription(p.description);
    setFormImageUrl(p.image);
    setFormImageFile(null);
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const fd = new FormData();
      fd.append('name', formName);
      fd.append('brand', formBrand);
      fd.append('category', formCategory);
      fd.append('price', formPrice);
      fd.append('discount_price', formDiscount);
      fd.append('stock', formStock);
      fd.append('sizes', formSizes);
      fd.append('colors', formColors);
      fd.append('description', formDescription);
      if (formImageFile) {
        fd.append('image_file', formImageFile);
      } else {
        fd.append('image', formImageUrl);
      }

      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, fd);
        showToast('Product updated in SQLite.', 'success');
      } else {
        await adminApi.createProduct(fd);
        showToast('New product created in SQLite.', 'success');
      }
      setModalOpen(false);
      await loadAll();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save product.'), 'error');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (id: number, name: string) => {
    try {
      await adminApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showToast(`Deleted "${name}".`, 'info');
      await loadAll();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete product.'), 'error');
    }
  };

  const handleOrderStatusChange = async (orderId: number, order_status: string) => {
    try {
      const res = await adminApi.updateOrder(orderId, { order_status });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      showToast(`Order #AV-${String(orderId).padStart(4, '0')} updated to ${order_status}.`, 'success');
      await loadAll();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update order status.'), 'error');
    }
  };

  const maxCategoryRevenue = Math.max(
    1,
    ...(dashboard?.category_breakdown.map((c) => Number(c.revenue || 0)) || [1])
  );
  const maxCategoryStock = Math.max(
    1,
    ...(dashboard?.category_breakdown.map((c) => Number(c.stock_count || 0)) || [1])
  );

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.category.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.brand.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Operations / Admin</p>
          <h1 className="font-editorial text-3xl font-semibold text-zinc-950 mt-1">Store Management Console</h1>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 border border-zinc-200 bg-white divide-y divide-zinc-100">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-medium text-left transition-colors ${
              tab === 'overview' ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analytics &amp; Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('products')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-medium text-left transition-colors ${
              tab === 'products' ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Products &amp; Inventory ({products.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-medium text-left transition-colors ${
              tab === 'orders' ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Orders ({orders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('customers')}
            className={`w-full flex items-center gap-3 px-4 py-3.5 text-xs font-medium text-left transition-colors ${
              tab === 'customers' ? 'bg-zinc-950 text-white' : 'text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customers &amp; Try-On Logs</span>
          </button>
        </aside>

        {/* Main Panel */}
        <div className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 bg-zinc-100 border border-zinc-200" />
              ))}
            </div>
          ) : tab === 'overview' && dashboard ? (
            <>
              {/* Real SQLite KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-zinc-200 bg-white p-5">
                  <span className="text-xs text-zinc-500 block">Total Revenue</span>
                  <span className="mt-2 text-2xl font-semibold text-zinc-950 font-mono tabular-nums block">
                    ${dashboard.kpis.total_revenue.toFixed(2)}
                  </span>
                  <span className="mt-1 text-[11px] text-zinc-500 block tabular-nums">
                    {dashboard.kpis.total_orders} total orders
                  </span>
                </div>

                <div className="border border-zinc-200 bg-white p-5">
                  <span className="text-xs text-zinc-500 block">Catalog Inventory</span>
                  <span className="mt-2 text-2xl font-semibold text-zinc-950 font-mono tabular-nums block">
                    {dashboard.kpis.total_stock} units
                  </span>
                  <span className="mt-1 text-[11px] text-zinc-500 block tabular-nums">
                    {dashboard.kpis.total_products} SKUs · {dashboard.kpis.low_stock_count} low stock
                  </span>
                </div>

                <div className="border border-zinc-200 bg-white p-5">
                  <span className="text-xs text-zinc-500 block">Registered Customers</span>
                  <span className="mt-2 text-2xl font-semibold text-zinc-950 font-mono tabular-nums block">
                    {dashboard.kpis.total_customers}
                  </span>
                  <span className="mt-1 text-[11px] text-zinc-500 block tabular-nums">
                    {dashboard.kpis.pending_orders} pending orders
                  </span>
                </div>

                <div className="border border-zinc-200 bg-white p-5">
                  <span className="text-xs text-zinc-500 block">AI Try-On Runs</span>
                  <span className="mt-2 text-2xl font-semibold text-zinc-950 font-mono tabular-nums block">
                    {dashboard.kpis.total_tryons}
                  </span>
                  <span className="mt-1 text-[11px] text-zinc-500 block tabular-nums">
                    {dashboard.kpis.completed_tryons} completed · {dashboard.kpis.failed_tryons} failed
                  </span>
                </div>
              </div>

              {/* Real Category Chart */}
              <div className="border border-zinc-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-zinc-950 font-sans mb-1">
                  Inventory &amp; Sales by Category
                </h2>
                <p className="text-xs text-zinc-500 mb-6">
                  Live SQLite aggregation across products and order line items
                </p>

                <div className="space-y-4">
                  {dashboard.category_breakdown.map((row) => {
                    const hasRevenue = dashboard.kpis.total_revenue > 0;
                    const pct = hasRevenue
                      ? Math.round((Number(row.revenue) / maxCategoryRevenue) * 100)
                      : Math.round((Number(row.stock_count) / maxCategoryStock) * 100);
                    return (
                      <div key={row.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-zinc-900">
                            {row.category}{' '}
                            <span className="text-zinc-400 font-normal">({row.product_count} products)</span>
                          </span>
                          <span className="font-mono tabular-nums text-zinc-700">
                            ${Number(row.revenue).toFixed(2)} · {row.stock_count} in stock
                          </span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 overflow-hidden">
                          <div className="h-full bg-zinc-950 transition-all" style={{ width: `${Math.max(4, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Status Breakdown */}
              <div className="border border-zinc-200 bg-white p-6">
                <h2 className="text-sm font-semibold text-zinc-950 font-sans mb-4">Order Pipeline Status</h2>
                {dashboard.order_status_breakdown.length === 0 ? (
                  <p className="text-xs text-zinc-500">No orders placed yet.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {dashboard.order_status_breakdown.map((item) => (
                      <div key={item.status} className="border border-zinc-200 p-4">
                        <span className="text-xs text-zinc-500">{item.status}</span>
                        <p className="mt-1 text-lg font-semibold text-zinc-950 font-mono tabular-nums">
                          {item.count} orders
                        </p>
                        <p className="text-xs text-zinc-600 font-mono tabular-nums">
                          ${Number(item.amount).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : tab === 'products' ? (
            <div className="border border-zinc-200 bg-white">
              <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-zinc-950 font-sans">Catalog &amp; Stock Management</h2>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="px-3 py-1.5 text-xs border border-zinc-300 bg-white sm:w-64"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="py-3 px-4 font-medium">Product</th>
                      <th className="py-3 px-4 font-medium">Category</th>
                      <th className="py-3 px-4 font-medium text-right">Price</th>
                      <th className="py-3 px-4 font-medium text-right">Stock</th>
                      <th className="py-3 px-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-zinc-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-12 bg-zinc-100 border border-zinc-200 shrink-0 overflow-hidden">
                              <SafeImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-semibold text-zinc-950">{p.name}</p>
                              <p className="text-[11px] text-zinc-500">{p.brand}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-700">{p.category}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          {p.discount_price !== null ? (
                            <span>
                              ${p.discount_price.toFixed(2)}{' '}
                              <span className="line-through text-zinc-400">${p.price.toFixed(2)}</span>
                            </span>
                          ) : (
                            <span>${p.price.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums">
                          <span className={p.stock <= 5 ? 'text-amber-700 font-semibold' : 'text-zinc-900'}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 border border-zinc-200 hover:border-zinc-950 text-zinc-700"
                              aria-label={`Edit ${p.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="p-1.5 border border-zinc-200 hover:border-red-600 text-red-600"
                              aria-label={`Delete ${p.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : tab === 'orders' ? (
            <div className="border border-zinc-200 bg-white">
              <div className="p-4 border-b border-zinc-200">
                <h2 className="text-sm font-semibold text-zinc-950 font-sans">Order Management</h2>
              </div>
              {orders.length === 0 ? (
                <div className="p-10 text-center text-xs text-zinc-500">No orders have been placed yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                      <tr>
                        <th className="py-3 px-4 font-medium">Order</th>
                        <th className="py-3 px-4 font-medium">Customer</th>
                        <th className="py-3 px-4 font-medium">Items</th>
                        <th className="py-3 px-4 font-medium text-right">Total</th>
                        <th className="py-3 px-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {orders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-zinc-50">
                          <td className="py-3 px-4 font-mono tabular-nums">
                            <span className="font-semibold text-zinc-950">
                              #AV-{String(ord.id).padStart(4, '0')}
                            </span>
                            <span className="block text-[11px] text-zinc-500">
                              {new Date(ord.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-medium text-zinc-950 block">{ord.customer_name}</span>
                            <span className="text-[11px] text-zinc-500">{ord.payment_method}</span>
                          </td>
                          <td className="py-3 px-4 text-zinc-700">
                            {ord.items.map((i) => `${i.product_name} ×${i.quantity}`).join(', ')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                            ${Number(ord.total_amount).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              aria-label={`Status for order ${ord.id}`}
                              value={ord.order_status}
                              onChange={(e) => handleOrderStatusChange(ord.id, e.target.value)}
                              className="border border-zinc-300 px-2.5 py-1.5 text-xs bg-white text-zinc-900"
                            >
                              {ORDER_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border border-zinc-200 bg-white">
                <div className="p-4 border-b border-zinc-200">
                  <h2 className="text-sm font-semibold text-zinc-950 font-sans">Registered Customers &amp; Admins</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                      <tr>
                        <th className="py-3 px-4 font-medium">Name</th>
                        <th className="py-3 px-4 font-medium">Email</th>
                        <th className="py-3 px-4 font-medium">Role</th>
                        <th className="py-3 px-4 font-medium text-right">Orders</th>
                        <th className="py-3 px-4 font-medium text-right">Total Spent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-50">
                          <td className="py-3 px-4 font-medium text-zinc-950">{c.name}</td>
                          <td className="py-3 px-4 text-zinc-600">{c.email}</td>
                          <td className="py-3 px-4 text-zinc-700 capitalize">{c.role}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums">{c.order_count}</td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                            ${Number(c.total_spent).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {dashboard && (
                <div className="border border-zinc-200 bg-white">
                  <div className="p-4 border-b border-zinc-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-zinc-950" />
                    <h2 className="text-sm font-semibold text-zinc-950 font-sans">Recent AI Try-On Sessions</h2>
                  </div>
                  {dashboard.recent_tryons.length === 0 ? (
                    <div className="p-8 text-center text-xs text-zinc-500">
                      No AI try-on sessions logged yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                          <tr>
                            <th className="py-3 px-4 font-medium">Session</th>
                            <th className="py-3 px-4 font-medium">User</th>
                            <th className="py-3 px-4 font-medium">Garment</th>
                            <th className="py-3 px-4 font-medium">Model</th>
                            <th className="py-3 px-4 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {dashboard.recent_tryons.map((t) => (
                            <tr key={t.id}>
                              <td className="py-3 px-4 font-mono tabular-nums">#{t.id}</td>
                              <td className="py-3 px-4">{t.user_name}</td>
                              <td className="py-3 px-4">{t.product_name}</td>
                              <td className="py-3 px-4 font-mono text-[11px]">{t.model_name}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={
                                    t.status === 'completed'
                                      ? 'text-emerald-700 font-semibold'
                                      : t.status === 'failed'
                                      ? 'text-red-600 font-semibold'
                                      : 'text-zinc-700'
                                  }
                                >
                                  {t.status}
                                </span>
                                {t.error_message && (
                                  <span className="block text-[11px] text-zinc-500 max-w-xs truncate">
                                    {t.error_message}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white border border-zinc-200 w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <h2 className="font-editorial text-2xl font-semibold text-zinc-950">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-zinc-500 hover:text-zinc-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Brand</label>
                  <input
                    type="text"
                    required
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Price (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Discount Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Stock</label>
                  <input
                    type="number"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Sizes (comma-separated)</label>
                  <input
                    type="text"
                    value={formSizes}
                    onChange={(e) => setFormSizes(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Colors (comma-separated)</label>
                  <input
                    type="text"
                    value={formColors}
                    onChange={(e) => setFormColors(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-zinc-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Upload Image File</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setFormImageFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-zinc-600 file:mr-3 file:py-1.5 file:px-3 file:border file:border-zinc-300 file:bg-zinc-50 file:text-xs file:font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Or Image Path / URL</label>
                  <input
                    type="text"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-zinc-300"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2.5 border border-zinc-300 text-xs font-medium text-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-6 py-2.5 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingProduct ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
