import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, XCircle } from 'lucide-react';
import type { Order } from '../types';
import { extractErrorMessage, ordersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { SafeImage } from '../components/SafeImage';

const TRACKING_STEPS = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];

export function OrdersPage() {
  const { user } = useAuth();
  const { showToast } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const loadOrders = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await ordersApi.list();
      setOrders(data.orders);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Unable to load orders.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [user]);

  const handleCancelOrder = async (orderId: number) => {
    setCancellingId(orderId);
    try {
      const res = await ordersApi.cancel(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      showToast(`Order #AV-${String(orderId).padStart(4, '0')} cancelled and stock restored.`, 'info');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Could not cancel order.'), 'error');
    } finally {
      setCancellingId(null);
    }
  };

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Package className="w-10 h-10 text-zinc-300 mx-auto mb-3 stroke-[1.25]" />
        <h1 className="font-editorial text-3xl font-semibold text-zinc-950">Order History</h1>
        <p className="text-sm text-zinc-500 mt-2">Sign in to view your orders and shipment status.</p>
        <Link to="/login" className="mt-6 inline-block px-6 py-3 bg-zinc-950 text-white text-xs font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="border-b border-zinc-200 pb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Account</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-1">Order History</h1>
        </div>
        <Link to="/shop" className="text-xs font-semibold text-zinc-950 hover:underline">
          Shop Collection
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 space-y-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-44 bg-zinc-100 border border-zinc-200" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-10 p-14 border border-zinc-200 bg-zinc-50 text-center">
          <Package className="w-9 h-9 text-zinc-300 mx-auto mb-3 stroke-[1.25]" />
          <p className="text-base font-medium text-zinc-900">No orders placed yet</p>
          <p className="text-xs text-zinc-500 mt-1">Your completed orders and tracking timelines will appear here.</p>
          <Link to="/shop" className="mt-5 inline-block px-5 py-2.5 bg-zinc-950 text-white text-xs font-semibold">
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {orders.map((order) => {
            const currentStepIdx = TRACKING_STEPS.indexOf(order.order_status);
            const canCancel = ['Pending', 'Confirmed'].includes(order.order_status);

            return (
              <div key={order.id} className="border border-zinc-200 bg-white">
                <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div className="flex flex-wrap items-center gap-6">
                    <div>
                      <span className="text-zinc-500 block">Order Number</span>
                      <span className="font-mono font-semibold text-zinc-950">
                        #AV-{String(order.id).padStart(4, '0')}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Placed</span>
                      <span className="text-zinc-900 tabular-nums">
                        {new Date(order.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Payment</span>
                      <span className="text-zinc-900">
                        {order.payment_method} · {order.payment_status}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Total</span>
                      <span className="font-semibold text-zinc-950 tabular-nums">
                        ${Number(order.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold ${
                        order.order_status === 'Cancelled'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : order.order_status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-zinc-950 text-white'
                      }`}
                    >
                      {order.order_status}
                    </span>
                    {canCancel && (
                      <button
                        type="button"
                        disabled={cancellingId === order.id}
                        onClick={() => handleCancelOrder(order.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 border border-zinc-300 text-zinc-700 hover:border-red-600 hover:text-red-600 text-xs font-medium"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>{cancellingId === order.id ? 'Cancelling...' : 'Cancel Order'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {order.order_status !== 'Cancelled' && (
                  <div className="px-6 py-4 border-b border-zinc-100">
                    <div className="grid grid-cols-5 gap-2">
                      {TRACKING_STEPS.map((st, idx) => {
                        const reached = currentStepIdx >= idx;
                        return (
                          <div key={st} className="space-y-1.5">
                            <div className={`h-1 w-full ${reached ? 'bg-zinc-950' : 'bg-zinc-200'}`} />
                            <p className={`text-[11px] ${reached ? 'font-semibold text-zinc-950' : 'text-zinc-400'}`}>
                              {st}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="p-6 space-y-4">
                  <p className="text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">Ship to:</span> {order.shipping_address}
                  </p>
                  <div className="divide-y divide-zinc-100">
                    {order.items.map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <Link
                            to={`/products/${item.product_id}`}
                            className="w-12 h-16 bg-zinc-50 border border-zinc-200 shrink-0 overflow-hidden"
                          >
                            <SafeImage
                              src={item.product_image}
                              alt={item.product_name}
                              className="w-full h-full object-cover"
                            />
                          </Link>
                          <div>
                            <Link
                              to={`/products/${item.product_id}`}
                              className="text-sm font-medium text-zinc-950 hover:underline"
                            >
                              {item.product_name}
                            </Link>
                            <p className="text-xs text-zinc-500">
                              Size {item.size} · {item.color} · Qty {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-zinc-950">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
