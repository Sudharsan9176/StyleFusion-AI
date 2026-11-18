import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, ShoppingBag, Sparkles, Star } from 'lucide-react';
import type { Product, Review } from '../types';
import { extractErrorMessage, productsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { SafeImage } from '../components/SafeImage';

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart, wishlistIds, toggleWishlist, showToast } = useStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    productsApi
      .getById(id)
      .then((data) => {
        setProduct(data.product);
        setReviews(data.reviews);
        setSelectedSize(data.product.sizes[0] || 'M');
        setSelectedColor(data.product.colors[0] || 'Black');
      })
      .catch((err) => setError(extractErrorMessage(err, 'Product not found.')))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    if (!user) {
      showToast('Please sign in to submit a product review.', 'info');
      navigate('/login');
      return;
    }
    if (!reviewText.trim()) {
      showToast('Please write a review comment.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await productsApi.addReview({
        product_id: product.id,
        rating: reviewRating,
        review_text: reviewText.trim(),
      });
      setReviews((prev) => [res.review, ...prev]);
      setProduct((prev) => (prev ? { ...prev, rating: res.updated_rating || prev.rating } : prev));
      setReviewText('');
      showToast('Thank you! Your review has been published.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to submit review.'), 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-pulse">
          <div className="lg:col-span-7 aspect-[3/4] bg-zinc-100" />
          <div className="lg:col-span-5 space-y-4">
            <div className="h-4 bg-zinc-100 w-1/3" />
            <div className="h-8 bg-zinc-100 w-3/4" />
            <div className="h-6 bg-zinc-100 w-1/4" />
            <div className="h-28 bg-zinc-100 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-base font-medium text-zinc-900">{error || 'Product not found'}</p>
        <Link to="/shop" className="mt-4 inline-block px-5 py-2.5 bg-zinc-950 text-white text-xs font-medium">
          Back to Catalog
        </Link>
      </div>
    );
  }

  const isWishlisted = wishlistIds.has(product.id);
  const effectivePrice = product.discount_price ?? product.price;
  const discountPercent =
    product.discount_price !== null ? Math.round(((product.price - product.discount_price) / product.price) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <Link
        to="/shop"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-950 mb-8"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Collection</span>
      </Link>

      {/* Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-7 lg:sticky lg:top-24">
          <div className="aspect-[3/4] bg-zinc-50 border border-zinc-200 overflow-hidden">
            <SafeImage
              src={product.image}
              alt={product.name}
              fallbackTitle={product.name}
              className="w-full h-full object-cover object-center"
            />
          </div>
        </div>

        <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>{product.brand}</span>
              <span aria-hidden="true">·</span>
              <span>{product.category}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">★ {product.rating.toFixed(1)} ({reviews.length} reviews)</span>
            </div>

            <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-2">
              {product.name}
            </h1>

            <div className="mt-3 flex items-baseline gap-3 tabular-nums">
              <span className="text-2xl font-semibold text-zinc-950">${effectivePrice.toFixed(2)}</span>
              {product.discount_price !== null && (
                <>
                  <span className="text-base text-zinc-400 line-through">${product.price.toFixed(2)}</span>
                  <span className="text-xs font-medium text-emerald-700">Save {discountPercent}%</span>
                </>
              )}
            </div>
          </div>

          <p className="text-sm text-zinc-600 leading-relaxed border-t border-b border-zinc-200 py-5">
            {product.description}
          </p>

          {/* Size Selection */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-zinc-950">Select Size</span>
              <span className="text-xs text-zinc-500">Selected: {selectedSize}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`min-w-[48px] px-3.5 py-2 text-xs font-medium border transition-colors ${
                    selectedSize === s
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-950'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selection */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-zinc-950">Select Color</span>
              <span className="text-xs text-zinc-500">{selectedColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`px-4 py-2 text-xs font-medium border transition-colors ${
                    selectedColor === c
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-800 border-zinc-300 hover:border-zinc-950'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Stock & Quantity */}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className={product.stock > 0 ? 'text-emerald-700 font-medium' : 'text-red-600 font-medium'}>
              {product.stock > 0 ? `In Stock · ${product.stock} available` : 'Out of Stock'}
            </span>
            {product.stock > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-zinc-500">Qty:</span>
                <select
                  aria-label="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="border border-zinc-300 px-2.5 py-1 text-xs bg-white tabular-nums"
                >
                  {Array.from({ length: Math.min(10, product.stock) }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Primary Actions */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-3">
              <button
                type="button"
                disabled={product.stock <= 0}
                onClick={() =>
                  addToCart({
                    product_id: product.id,
                    quantity,
                    selected_size: selectedSize,
                    selected_color: selectedColor,
                  })
                }
                className="flex-1 py-3.5 px-6 bg-zinc-950 text-white text-xs font-semibold tracking-wide hover:bg-zinc-800 disabled:bg-zinc-400 transition-colors inline-flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{product.stock > 0 ? 'Add to Shopping Bag' : 'Out of Stock'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                aria-label="Toggle wishlist"
                className={`px-4 border transition-colors ${
                  isWishlisted
                    ? 'bg-zinc-950 text-white border-zinc-950'
                    : 'bg-white text-zinc-900 border-zinc-300 hover:border-zinc-950'
                }`}
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/tryon?productId=${product.id}`)}
              className="w-full py-3.5 px-6 border border-zinc-950 bg-white text-zinc-950 text-xs font-semibold tracking-wide hover:bg-zinc-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Virtual Try-On With This Garment</span>
            </button>
          </div>
        </div>
      </div>

      {/* Product Reviews Section */}
      <section className="mt-20 pt-12 border-t border-zinc-200 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-5">
          <h2 className="font-editorial text-2xl sm:text-3xl font-semibold text-zinc-950">Client Reviews</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Average rating {product.rating.toFixed(1)} out of 5 across {reviews.length} verified reviews.
          </p>

          <form onSubmit={handleReviewSubmit} className="mt-6 p-6 border border-zinc-200 bg-zinc-50 space-y-4">
            <h3 className="text-xs font-semibold text-zinc-950 uppercase tracking-wide">Write a Review</h3>
            <div>
              <label className="block text-xs text-zinc-600 mb-1.5">Rating</label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`p-1.5 border ${
                      reviewRating >= star ? 'bg-zinc-950 text-white border-zinc-950' : 'bg-white text-zinc-400 border-zinc-200'
                    }`}
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-600 mb-1.5">Comment</label>
              <textarea
                rows={3}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share notes on fabric, drape, and sizing..."
                className="w-full px-3 py-2 text-sm border border-zinc-300 bg-white focus:outline-none focus:border-zinc-950"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="px-5 py-2.5 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
            >
              {submittingReview ? 'Submitting...' : 'Publish Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {reviews.length === 0 ? (
            <div className="p-8 border border-zinc-200 text-center text-sm text-zinc-500">
              No client reviews yet. Be the first to review this piece.
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="p-6 border border-zinc-200 bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-zinc-950">{rev.user_name}</span>
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {new Date(rev.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 text-xs text-zinc-900 tabular-nums">
                  {'★'.repeat(rev.rating)}
                  <span className="text-zinc-300">{'★'.repeat(5 - rev.rating)}</span>
                </div>
                <p className="mt-3 text-sm text-zinc-700 leading-relaxed">{rev.review_text}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
