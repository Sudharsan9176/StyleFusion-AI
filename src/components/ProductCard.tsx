import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { SafeImage } from './SafeImage';

export function ProductCard({ product }: { product: Product }) {
  const { wishlistIds, toggleWishlist, addToCart } = useStore();
  const navigate = useNavigate();
  const isWishlisted = wishlistIds.has(product.id);
  const displayPrice = product.discount_price ?? product.price;

  return (
    <article className="group flex flex-col bg-white transition-transform duration-150 hover:-translate-y-0.5">
      <div className="relative aspect-[3/4] w-full bg-zinc-50 border border-zinc-200 overflow-hidden">
        <Link to={`/products/${product.id}`} className="block w-full h-full">
          <SafeImage
            src={product.image}
            alt={product.name}
            fallbackTitle={product.name}
            className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>

        {/* Subtle action buttons on top right */}
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => toggleWishlist(product.id)}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
            className={`p-2 border transition-colors ${
              isWishlisted
                ? 'bg-zinc-950 text-white border-zinc-950'
                : 'bg-white/90 text-zinc-800 border-zinc-200 hover:border-zinc-950'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Hover quick actions at bottom of image */}
        <div className="absolute inset-x-3 bottom-3 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            onClick={() =>
              addToCart({
                product_id: product.id,
                quantity: 1,
                selected_size: product.sizes[0] || 'M',
                selected_color: product.colors[0] || 'Black',
              })
            }
            disabled={product.stock <= 0}
            className="flex-1 py-2 px-3 bg-zinc-950 text-white text-xs font-medium hover:bg-zinc-800 disabled:bg-zinc-400 transition-colors whitespace-nowrap"
          >
            {product.stock > 0 ? 'Quick Add' : 'Sold Out'}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/tryon?productId=${product.id}`)}
            className="py-2 px-3 bg-white text-zinc-950 border border-zinc-300 hover:border-zinc-950 text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try On</span>
          </button>
        </div>
      </div>

      <div className="pt-3.5 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span>{product.brand}</span>
          <span aria-hidden="true">·</span>
          <span>{product.category}</span>
          {product.stock <= 5 && product.stock > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700 font-medium">Low Stock</span>
            </>
          )}
        </div>

        <Link
          to={`/products/${product.id}`}
          className="text-sm font-semibold text-zinc-950 hover:underline underline-offset-4 line-clamp-1"
        >
          {product.name}
        </Link>

        <div className="flex items-baseline justify-between mt-0.5">
          <div className="flex items-baseline gap-2 tabular-nums">
            <span className="text-sm font-semibold text-zinc-950">${displayPrice.toFixed(2)}</span>
            {product.discount_price !== null && (
              <span className="text-xs text-zinc-400 line-through">${product.price.toFixed(2)}</span>
            )}
          </div>
          <span className="text-xs text-zinc-500 tabular-nums">★ {product.rating.toFixed(1)}</span>
        </div>
      </div>
    </article>
  );
}
