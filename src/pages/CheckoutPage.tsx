import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, CreditCard, Lock, Truck } from 'lucide-react';
import type { Order } from '../types';
import { extractErrorMessage, ordersApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { SafeImage } from '../components/SafeImage';

export function CheckoutPage() {
  const { user } = useAuth();
  const { cartItems, cartSummary, updateCartItem, refreshCart, showToast } = useStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fullName, setFullName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [street, setStreet] = useState(user?.address || '');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [paymentMethod, setPaymentMethod] = useState<'Cash on Delivery' | 'Test Card Payment'>('Cash on Delivery');
  const [cardNumber, setCardNumber] = useState('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('424');

  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (user) {
      setFullName((v) => v || user.name);
      setPhone((v) => v || user.phone || '');
      setStreet((v) => v || user.address || '');
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Lock className="w-9 h-9 text-zinc-400 mx-auto mb-3 stroke-[1.25]" />
        <h1 className="font-editorial text-3xl font-semibold text-zinc-950">Checkout</h1>
        <p className="text-sm text-zinc-500 mt-2">Sign in to complete your order and track shipping.</p>
        <Link to="/login" className="mt-6 inline-block px-6 py-3 bg-zinc-950 text-white text-xs font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  if (confirmedOrder) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
        <div className="border border-zinc-200 bg-white p-8 sm:p-10">
          <div className="flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
            <span className="text-xs font-semibold uppercase tracking-wide">Order Confirmed</span>
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-2">
            Thank You, {user.name.split(' ')[0]}
          </h1>
          <p className="text-sm text-zinc-600 mt-2">
            Order <span className="font-mono font-semibold text-zinc-950">#AV-{String(confirmedOrder.id).padStart(4, '0')}</span> has been recorded in our system.
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-zinc-200 py-5 text-xs">
            <div>
              <span className="text-zinc-500 block">Status</span>
              <span className="font-semibold text-zinc-950 mt-0.5 block">{confirmedOrder.order_status}</span>
            </div>
            <div>
              <span className="text-zinc-500 block">Payment</span>
              <span className="font-semibold text-zinc-950 mt-0.5 block">
                {confirmedOrder.payment_method} · {confirmedOrder.payment_status}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block">Total Paid / Due</span>
              <span className="font-semibold text-zinc-950 tabular-nums mt-0.5 block">
                ${Number(confirmedOrder.total_amount).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-3 font-sans">
              Shipping Address
            </h2>
            <p className="text-sm text-zinc-800">{confirmedOrder.shipping_address}</p>
          </div>

          <div className="mt-6 space-y-3">
            {confirmedOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4 py-2 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-16 bg-zinc-50 border border-zinc-200 overflow-hidden">
                    <SafeImage src={item.product_image} alt={item.product_name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-950">{item.product_name}</p>
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

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/orders"
              className="px-6 py-3 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800"
            >
              View Order History
            </Link>
            <Link
              to="/shop"
              className="px-6 py-3 border border-zinc-300 text-zinc-900 text-xs font-semibold hover:border-zinc-950"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-editorial text-3xl font-semibold text-zinc-950">Your Bag Is Empty</h1>
        <p className="text-sm text-zinc-500 mt-2">Add garments before proceeding to checkout.</p>
        <button
          type="button"
          onClick={() => navigate('/shop')}
          className="mt-6 px-6 py-3 bg-zinc-950 text-white text-xs font-semibold"
        >
          Browse Collection
        </button>
      </div>
    );
  }

  const composedAddress = [fullName.trim(), phone.trim(), street.trim(), city.trim(), postalCode.trim()]
    .filter(Boolean)
    .join(', ');

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !street.trim()) {
      showToast('Please complete recipient name, phone number, and street address.', 'error');
      setStep(2);
      return;
    }

    const digits = cardNumber.replace(/\D/g, '');
    if (paymentMethod === 'Test Card Payment' && (digits.length < 12 || !cardExpiry.trim() || cardCvc.length < 3)) {
      showToast('Please enter valid test card details.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await ordersApi.create({
        shipping_address: composedAddress,
        payment_method: paymentMethod,
        card_last4: paymentMethod === 'Test Card Payment' ? digits.slice(-4) : undefined,
      });
      await refreshCart();
      setConfirmedOrder(res.order);
      showToast('Order placed successfully.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to place order.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="border-b border-zinc-200 pb-6">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Checkout</p>
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-1">
          Complete Your Order
        </h1>

        <div className="mt-5 flex items-center gap-6 text-xs">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`pb-1 border-b-2 font-medium ${
              step === 1 ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-500'
            }`}
          >
            01. Review Items
          </button>
          <button
            type="button"
            onClick={() => setStep(2)}
            className={`pb-1 border-b-2 font-medium ${
              step === 2 ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-500'
            }`}
          >
            02. Delivery Address
          </button>
          <button
            type="button"
            onClick={() => setStep(3)}
            className={`pb-1 border-b-2 font-medium ${
              step === 3 ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-500'
            }`}
          >
            03. Payment &amp; Confirm
          </button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-7 space-y-6">
          {step === 1 && (
            <div className="border border-zinc-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-950 font-sans">01. Verify Size &amp; Color</h2>
              <div className="divide-y divide-zinc-100">
                {cartItems.map((item) => {
                  const unitPrice = item.product.discount_price ?? item.product.price;
                  return (
                    <div key={item.id} className="py-4 flex items-center gap-4">
                      <div className="w-16 h-22 bg-zinc-50 border border-zinc-200 shrink-0 overflow-hidden">
                        <SafeImage src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-950 truncate">{item.product.name}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <select
                            aria-label="Size"
                            value={item.selected_size}
                            onChange={(e) => updateCartItem(item.id, { selected_size: e.target.value })}
                            className="text-xs border border-zinc-300 px-2 py-1 bg-white"
                          >
                            {item.product.sizes.map((s) => (
                              <option key={s} value={s}>
                                Size {s}
                              </option>
                            ))}
                          </select>
                          <select
                            aria-label="Color"
                            value={item.selected_color}
                            onChange={(e) => updateCartItem(item.id, { selected_color: e.target.value })}
                            className="text-xs border border-zinc-300 px-2 py-1 bg-white"
                          >
                            {item.product.colors.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="text-sm font-semibold text-zinc-950">
                          ${(unitPrice * item.quantity).toFixed(2)}
                        </p>
                        <p className="text-xs text-zinc-500">Qty {item.quantity}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-3 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800"
              >
                Continue to Delivery Address
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="border border-zinc-200 bg-white p-6 space-y-4">
              <h2 className="text-sm font-semibold text-zinc-950 font-sans">02. Delivery Address</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Street Address</label>
                <input
                  type="text"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  required
                  placeholder="42 Mercer Street, Apt 4B"
                  className="w-full px-3 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="New York"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Postal Code</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="10013"
                    className="w-full px-3 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3 border border-zinc-300 text-xs font-medium text-zinc-800"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!fullName.trim() || !phone.trim() || !street.trim()) {
                      showToast('Please enter recipient name, phone, and street address.', 'error');
                      return;
                    }
                    setStep(3);
                  }}
                  className="px-6 py-3 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800"
                >
                  Continue to Payment
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handlePlaceOrder} className="border border-zinc-200 bg-white p-6 space-y-5">
              <h2 className="text-sm font-semibold text-zinc-950 font-sans">03. Payment Method</h2>

              <div className="p-3 bg-zinc-50 border border-zinc-200 text-xs text-zinc-700">
                <span className="font-semibold text-zinc-950">Delivering to: </span>
                {composedAddress}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash on Delivery')}
                  className={`p-4 border text-left transition-colors ${
                    paymentMethod === 'Cash on Delivery'
                      ? 'border-zinc-950 bg-zinc-50'
                      : 'border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <Truck className="w-4 h-4 text-zinc-950 mb-2" />
                  <p className="text-xs font-semibold text-zinc-950">Cash on Delivery (COD)</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Pay upon delivery in cash or mobile tap</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('Test Card Payment')}
                  className={`p-4 border text-left transition-colors ${
                    paymentMethod === 'Test Card Payment'
                      ? 'border-zinc-950 bg-zinc-50'
                      : 'border-zinc-200 hover:border-zinc-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-zinc-950 mb-2" />
                  <p className="text-xs font-semibold text-zinc-950">Test Card Payment (Sandbox)</p>
                  <p className="text-[11px] text-zinc-500 mt-0.5">Instant sandbox authorization</p>
                </button>
              </div>

              {paymentMethod === 'Test Card Payment' && (
                <div className="p-4 border border-zinc-200 bg-zinc-50 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Test Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white font-mono tabular-nums"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">Expiry</label>
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">CVC</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white font-mono tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-3 border border-zinc-300 text-xs font-medium text-zinc-800"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-6 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
                >
                  {submitting
                    ? 'Processing Order...'
                    : `Confirm Order · $${cartSummary.total.toFixed(2)}`}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <aside className="lg:col-span-5 border border-zinc-200 bg-zinc-50 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-zinc-950 font-sans pb-3 border-b border-zinc-200">
            Order Summary ({cartSummary.item_count} items)
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {cartItems.map((item) => {
              const price = item.product.discount_price ?? item.product.price;
              return (
                <div key={item.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-700 truncate pr-4">
                    {item.product.name} ({item.selected_size}) × {item.quantity}
                  </span>
                  <span className="font-medium text-zinc-950 tabular-nums shrink-0">
                    ${(price * item.quantity).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-zinc-200 pt-4 space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal</span>
              <span className="tabular-nums">${cartSummary.subtotal.toFixed(2)}</span>
            </div>
            {cartSummary.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Collection Savings</span>
                <span className="tabular-nums">-${cartSummary.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-600">
              <span>Shipping (Free over $250)</span>
              <span className="tabular-nums">
                {cartSummary.shipping === 0 ? '$0.00' : `$${cartSummary.shipping.toFixed(2)}`}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-zinc-950 pt-3 border-t border-zinc-200">
              <span>Total</span>
              <span className="tabular-nums">${cartSummary.total.toFixed(2)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
