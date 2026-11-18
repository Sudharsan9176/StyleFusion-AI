import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Pagination, Product } from '../types';
import { extractErrorMessage, productsApi } from '../services/api';
import { ProductCard } from '../components/ProductCard';

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', '28', '30', '32', '34', '36'];
const ALL_COLORS = ['Black', 'White', 'Ivory', 'Charcoal', 'Slate', 'Indigo', 'Sand'];

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [size, setSize] = useState(searchParams.get('size') || '');
  const [color, setColor] = useState(searchParams.get('color') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'newest');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);

  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 9, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    productsApi
      .getCategories()
      .then((d) => setCategories(d.categories))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlCategory = searchParams.get('category') || 'All';
    setSearch(urlSearch);
    setCategory(urlCategory);
  }, [searchParams]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await productsApi.list({
        search: search || undefined,
        category: category !== 'All' ? category : undefined,
        size: size || undefined,
        color: color || undefined,
        min_price: minPrice || undefined,
        max_price: maxPrice || undefined,
        sort,
        page,
        limit: 9,
      });
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load products.'));
    } finally {
      setLoading(false);
    }
  }, [search, category, size, color, minPrice, maxPrice, sort, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const clearAllFilters = () => {
    setSearch('');
    setCategory('All');
    setSize('');
    setColor('');
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
    setPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(search || category !== 'All' || size || color || minPrice || maxPrice);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="border-b border-zinc-200 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Catalog</p>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-1">
            {category === 'All' ? 'All Apparel & Tailoring' : category}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search garments..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-300 bg-white focus:outline-none focus:border-zinc-950"
            />
          </div>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium border border-zinc-300 bg-white text-zinc-900 focus:outline-none focus:border-zinc-950"
          >
            <option value="newest">Sort: Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>

          <button
            type="button"
            onClick={() => setFiltersOpen((p) => !p)}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-zinc-300 text-zinc-900"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Category Bar */}
      <div className="flex items-center gap-2 overflow-x-auto py-4 border-b border-zinc-100">
        <button
          type="button"
          onClick={() => {
            setCategory('All');
            setPage(1);
          }}
          className={`px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
            category === 'All'
              ? 'bg-zinc-950 text-white'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950'
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.category}
            type="button"
            onClick={() => {
              setCategory(c.category);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              category === c.category
                ? 'bg-zinc-950 text-white'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 hover:text-zinc-950'
            }`}
          >
            {c.category} ({c.count})
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar Filters */}
        <aside className={`lg:col-span-3 space-y-6 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-950 font-sans">Refine By</h2>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-zinc-500 hover:text-zinc-950 inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Clear all</span>
              </button>
            )}
          </div>

          {/* Size Filter */}
          <div className="pt-4 border-t border-zinc-200">
            <h3 className="text-xs font-semibold text-zinc-900 mb-3">Size</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {ALL_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setSize(size === s ? '' : s);
                    setPage(1);
                  }}
                  className={`py-1.5 text-xs font-medium border transition-colors ${
                    size === s
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-950'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Color Filter */}
          <div className="pt-4 border-t border-zinc-200">
            <h3 className="text-xs font-semibold text-zinc-900 mb-3">Color</h3>
            <div className="flex flex-wrap gap-1.5">
              {ALL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(color === c ? '' : c);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium border transition-colors ${
                    color === c
                      ? 'bg-zinc-950 text-white border-zinc-950'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-950'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="pt-4 border-t border-zinc-200">
            <h3 className="text-xs font-semibold text-zinc-900 mb-3">Price Range (USD)</h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                placeholder="Min $"
                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 bg-white tabular-nums"
              />
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                placeholder="Max $"
                className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 bg-white tabular-nums"
              />
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9">
          <div className="mb-4 flex items-center justify-between text-xs text-zinc-500">
            <span className="tabular-nums">
              Showing {products.length} of {pagination.total} garments
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="space-y-3 animate-pulse">
                  <div className="aspect-[3/4] bg-zinc-100 border border-zinc-200" />
                  <div className="h-3 bg-zinc-100 w-1/3" />
                  <div className="h-4 bg-zinc-100 w-2/3" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-10 border border-zinc-200 bg-zinc-50 text-center">
              <p className="text-sm text-zinc-800">{error}</p>
              <button
                type="button"
                onClick={fetchProducts}
                className="mt-4 px-5 py-2 bg-zinc-950 text-white text-xs font-medium"
              >
                Retry
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="p-14 border border-zinc-200 bg-zinc-50 text-center">
              <p className="text-base font-medium text-zinc-900">No garments match your active filters</p>
              <p className="text-xs text-zinc-500 mt-1">
                Try clearing size, color, or price filters to view the full collection.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-5 px-5 py-2.5 bg-zinc-950 text-white text-xs font-medium hover:bg-zinc-800"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="mt-12 pt-6 border-t border-zinc-200 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-4 py-2 text-xs font-medium border border-zinc-300 disabled:opacity-40 hover:border-zinc-950"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-zinc-600 tabular-nums">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                    className="px-4 py-2 text-xs font-medium border border-zinc-300 disabled:opacity-40 hover:border-zinc-950"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
