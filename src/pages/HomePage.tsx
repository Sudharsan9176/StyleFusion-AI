import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Layers, Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { extractErrorMessage, productsApi } from '../services/api';
import { ProductCard } from '../components/ProductCard';
import { SafeImage } from '../components/SafeImage';

export function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeatured = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.list({ limit: 6, sort: 'rating' });
      setFeatured(data.products);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load collection.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeatured();
  }, []);

  return (
    <div>
      {/* 1. Editorial Campaign Hero */}
      <section className="relative w-full border-b border-zinc-200">
        <div className="relative h-[74vh] min-h-[520px] max-h-[760px] w-full overflow-hidden bg-zinc-900">
          <SafeImage
            src="/src/assets/images/hero_atelier_editorial_1794992371896.jpg"
            alt="StyleFusion AI Fall-Winter Editorial Campaign"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />

          <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-12 sm:pb-16">
            <div className="max-w-2xl text-white">
              <p className="text-xs font-medium tracking-widest uppercase text-zinc-300 mb-3">
                Autumn / Winter Collection
              </p>
              <h1 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] text-balance">
                Architectural Tailoring, Previewed on You
              </h1>
              <p className="mt-4 text-sm sm:text-base text-zinc-200 max-w-xl leading-relaxed">
                Explore Italian wool coats, organic mulberry silk shirting, and structured knitwear. Upload a portrait
                to preview any garment on yourself with real-time Hugging Face AI Virtual Try-On.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-zinc-950 text-xs font-semibold tracking-wide hover:bg-zinc-100 transition-colors whitespace-nowrap"
                >
                  <span>Shop Collection</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/tryon"
                  className="inline-flex items-center gap-2 px-6 py-3 border border-white/60 text-white text-xs font-semibold tracking-wide hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Open Virtual Try-On</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Featured Collection Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-8 border-b border-zinc-200">
          <div>
            <p className="text-xs font-medium text-zinc-500 tracking-wide uppercase">Curated Selection</p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-1">
              Featured Wardrobe Pieces
            </h2>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-950 hover:underline underline-offset-4 whitespace-nowrap"
          >
            <span>View Full Catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="space-y-3 animate-pulse">
                <div className="aspect-[3/4] bg-zinc-100 border border-zinc-200" />
                <div className="h-3 bg-zinc-100 w-1/3" />
                <div className="h-4 bg-zinc-100 w-2/3" />
                <div className="h-3 bg-zinc-100 w-1/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-10 p-8 border border-zinc-200 bg-zinc-50 text-center">
            <p className="text-sm text-zinc-700">{error}</p>
            <button
              type="button"
              onClick={loadFeatured}
              className="mt-4 px-5 py-2 bg-zinc-950 text-white text-xs font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-10">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* 3. Virtual Try-On Feature Editorial Split */}
      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 grid grid-cols-2 gap-4">
              <div className="aspect-[3/4] border border-zinc-200 bg-white overflow-hidden">
                <SafeImage
                  src="/src/assets/images/product_wool_overcoat_1794992372142.jpg"
                  alt="Double-Breasted Wool Overcoat"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="aspect-[3/4] border border-zinc-200 bg-white overflow-hidden">
                <SafeImage
                  src="/src/assets/images/product_midi_dress_1794992373277.jpg"
                  alt="Pleated A-Line Midi Dress"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="lg:col-span-6 flex flex-col justify-between bg-white border border-zinc-200 p-8 sm:p-10">
              <div>
                <p className="text-xs font-medium text-zinc-500 tracking-wide uppercase">
                  Hugging Face Virtual Fitting Room
                </p>
                <h2 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-2 text-balance">
                  See How Every Silhouette Fits Before Checkout
                </h2>
                <p className="mt-4 text-sm text-zinc-600 leading-relaxed">
                  Upload a single front-facing photograph once, then switch seamlessly across coats, shirts, dresses,
                  and knitwear from our catalog.
                </p>

                <div className="mt-8 space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 border border-zinc-200 flex items-center justify-center shrink-0">
                      <Camera className="w-4 h-4 text-zinc-950" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">01. Upload Your Portrait</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Drag and drop a JPG or PNG photo. Validated for resolution and kept ready across garments.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 border border-zinc-200 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-zinc-950" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">02. Pair With Catalog Garments</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Select any in-stock item from our SQLite catalog—from tailored jackets to handloom silk kurtas.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 border border-zinc-200 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-zinc-950" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-950">03. Inspect Before &amp; After</h3>
                      <p className="text-xs text-zinc-500 mt-1">
                        Compare your original photo against the Hugging Face generated image, download it, or add
                        straight to bag.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-100">
                <Link
                  to="/tryon"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
                >
                  <span>Launch Virtual Try-On Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
