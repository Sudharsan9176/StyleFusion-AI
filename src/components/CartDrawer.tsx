import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SafeImage } from './SafeImage';

export function CartDrawer() {
  const { cartItems, cartSummary, isCartOpen, setIsCartOpen, updateCartItem, removeFromCart } = useStore();
  const navigate = useNavigate();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={() => setIsCartOpen(false)}
        aria-hidden="true"
      />
      <aside
        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-zinc-200 z-10"
        aria-label="Shopping Bag"
      >
        <div className="px-6 py-5 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-zinc-950" />
            <h2 className="text-base font-semibold text-zinc-950 font-sans">
              Shopping Bag <span className="tabular-nums text-zinc-500 font-normal">({cartSummary.item_count})</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 text-zinc-500 hover:text-zinc-950 transition-colors"
            aria-label="Close bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-10 h-10 text-zinc-300 mb-3 stroke-[1.25]" />
              <p className="text-sm font-medium text-zinc-900">Your shopping bag is empty</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                Explore tailored outerwear, silk shirting, or preview pieces in the Virtual Try-On studio.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  navigate('/shop');
                }}
                className="mt-5 px-5 py-2.5 bg-zinc-950 text-white text-xs font-medium hover:bg-zinc-800 transition-colors"
              >
                Browse Collection
              </button>
            </div>
          ) : (
            cartItems.map((item) => {
              const unitPrice = item.product.discount_price ?? item.product.price;
              return (
                <div key={item.id} className="flex gap-4 pb-5 border-b border-zinc-100">
                  <Link
                    to={`/products/${item.product_id}`}
                    onClick={() => setIsCartOpen(false)}
                    className="w-20 h-26 bg-zinc-50 border border-zinc-200 shrink-0 overflow-hidden"
                  >
                    <SafeImage
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-full h-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/products/${item.product_id}`}
                          onClick={() => setIsCartOpen(false)}
                          className="text-sm font-medium text-zinc-950 hover:underline truncate"
                        >
                          {item.product.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="text-zinc-400 hover:text-red-600 transition-colors p-0.5"
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <select
                          aria-label="Size"
                          value={item.selected_size}
                          onChange={(e) => updateCartItem(item.id, { selected_size: e.target.value })}
                          className="text-xs border border-zinc-200 px-2 py-1 bg-white text-zinc-800"
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
                          className="text-xs border border-zinc-200 px-2 py-1 bg-white text-zinc-800"
                        >
                          {item.product.colors.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="inline-flex items-center border border-zinc-200">
                        <button
                          type="button"
                          onClick={() => updateCartItem(item.id, { quantity: item.quantity - 1 })}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2.5 text-xs font-mono tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartItem(item.id, { quantity: item.quantity + 1 })}
                          disabled={item.quantity >= item.product.stock}
                          className="p-1.5 text-zinc-600 hover:text-zinc-950 disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold tabular-nums text-zinc-950">
                        ${(unitPrice * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {cartItems.length > 0 && (
          <div className="border-t border-zinc-200 px-6 py-5 bg-zinc-50 space-y-3">
            <div className="space-y-1.5 text-xs">
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
                <span>Shipping {cartSummary.shipping === 0 ? '(Complimentary)' : ''}</span>
                <span className="tabular-nums">
                  {cartSummary.shipping === 0 ? '$0.00' : `$${cartSummary.shipping.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-zinc-950 pt-2 border-t border-zinc-200">
                <span>Total</span>
                <span className="tabular-nums">${cartSummary.total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCartOpen(false);
                navigate('/checkout');
              }}
              className="w-full py-3 bg-zinc-950 text-white text-xs font-semibold tracking-wide hover:bg-zinc-800 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
