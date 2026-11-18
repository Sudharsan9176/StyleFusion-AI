import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { SafeImage } from '../components/SafeImage';

export function WishlistPage() {
  const { user } = useAuth();
  const { wishlistItems, toggleWishlist, addToCart } = useStore();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Heart className="w-10 h-10 text-zinc-300 mx-auto mb-3 stroke-[1.25]" />
        <h1 className="font-editorial text-3xl font-semibold text-zinc-950">Your Wishlist</h1>
        <p className="text-sm text-zinc-500 mt-2">Sign in to save garments and move pieces to your shopping bag.</p>
        <Link to="/login" className="mt-6 inline-block px-6 py-3 bg-zinc-950 text-white text-xs font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  const handleMoveToCart = async (item: (typeof wishlistItems)[number]) => {
    const ok = await addToCart({
      product_id: item.product.id,
      quantity: 1,
      selected_size: item.product.sizes[0] || 'M',
      selected_color: item.product.colors[0] || 'Black',
    });
    if (ok) {
      await toggleWishlist(item.product.id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="border-b border-zinc-200 pb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Saved Pieces</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-1">
            Wishlist <span className="text-zinc-400 text-2xl tabular-nums">({wishlistItems.length})</span>
          </h1>
        </div>
        <Link to="/shop" className="text-xs font-semibold text-zinc-950 hover:underline">
          Continue Shopping
        </Link>
      </div>

      {wishlistItems.length === 0 ? (
        <div className="mt-12 p-14 border border-zinc-200 bg-zinc-50 text-center">
          <Heart className="w-9 h-9 text-zinc-300 mx-auto mb-3 stroke-[1.25]" />
          <p className="text-base font-medium text-zinc-900">Your wishlist is empty</p>
          <p className="text-xs text-zinc-500 mt-1">Save pieces you want to try on or revisit later.</p>
          <Link
            to="/shop"
            className="mt-5 inline-block px-5 py-2.5 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {wishlistItems.map((item) => {
            const p = item.product;
            const price = p.discount_price ?? p.price;
            return (
              <div key={item.id} className="border border-zinc-200 bg-white flex flex-col">
                <Link to={`/products/${p.id}`} className="aspect-[3/4] bg-zinc-50 overflow-hidden block">
                  <SafeImage src={p.image} alt={p.name} className="w-full h-full object-cover" />
                </Link>
                <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs text-zinc-500">
                      {p.brand} · {p.category}
                    </p>
                    <Link to={`/products/${p.id}`} className="text-sm font-semibold text-zinc-950 hover:underline mt-0.5 block">
                      {p.name}
                    </Link>
                    <p className="text-sm font-semibold text-zinc-950 tabular-nums mt-1">${price.toFixed(2)}</p>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={p.stock <= 0}
                      onClick={() => handleMoveToCart(item)}
                      className="w-full py-2.5 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 disabled:bg-zinc-300 inline-flex items-center justify-center gap-1.5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{p.stock > 0 ? 'Move to Bag' : 'Out of Stock'}</span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/tryon?productId=${p.id}`)}
                        className="py-2 border border-zinc-300 text-xs font-medium text-zinc-900 hover:border-zinc-950 inline-flex items-center justify-center gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Try On</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(p.id)}
                        className="py-2 border border-zinc-300 text-xs font-medium text-red-600 hover:border-red-600 inline-flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
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
