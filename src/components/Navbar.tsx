import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingBag, User as UserIcon, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

export function Navbar() {
  const { user, logout } = useAuth();
  const { cartSummary, wishlistIds, setIsCartOpen } = useStore();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    setSearchOpen(false);
    setMobileOpen(false);
    navigate(trimmed ? `/shop?search=${encodeURIComponent(trimmed)}` : '/shop');
  };

  const navLinks = [
    { to: '/shop', label: 'Shop' },
    { to: '/tryon', label: 'Virtual Try-On' },
    { to: '/wishlist', label: `Wishlist${wishlistIds.size > 0 ? ` (${wishlistIds.size})` : ''}` },
    { to: '/orders', label: 'Orders' },
  ];

  if (user?.role === 'admin') {
    navLinks.push({ to: '/admin', label: 'Admin' });
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <Link
          to="/"
          className="font-editorial text-2xl font-semibold tracking-tight text-zinc-950 whitespace-nowrap shrink-0"
        >
          StyleFusion AI
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
          {navLinks.map((link) => {
            const active = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors duration-150 ${
                  active
                    ? 'text-zinc-950 border-zinc-950'
                    : 'border-transparent hover:text-zinc-950 hover:border-zinc-300'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Compact Store Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen((prev) => !prev)}
            className="p-2 text-zinc-700 hover:text-zinc-950 transition-colors"
            aria-label="Search catalog"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-zinc-900 hover:text-zinc-600 transition-colors whitespace-nowrap shrink-0"
            aria-label="Open shopping bag"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="tabular-nums text-xs font-mono">({cartSummary.item_count})</span>
          </button>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-xs font-medium border border-zinc-200 hover:border-zinc-950 text-zinc-900 transition-colors whitespace-nowrap shrink-0"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span className="max-w-[110px] truncate">{user.name.split(' ')[0]}</span>
              </button>
              {accountMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 shadow-lg py-1 z-50"
                  onMouseLeave={() => setAccountMenuOpen(false)}
                >
                  <Link
                    to="/profile"
                    onClick={() => setAccountMenuOpen(false)}
                    className="block px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                  >
                    Account Profile
                  </Link>
                  <Link
                    to="/orders"
                    onClick={() => setAccountMenuOpen(false)}
                    className="block px-4 py-2 text-xs text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950"
                  >
                    Order History
                  </Link>
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setAccountMenuOpen(false)}
                      className="block px-4 py-2 text-xs font-medium text-zinc-950 hover:bg-zinc-50"
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  <div className="border-t border-zinc-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      logout();
                      navigate('/');
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-zinc-50"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center px-4 py-2 text-xs font-medium bg-zinc-950 text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden p-2 text-zinc-800"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expandable Search Bar */}
      {searchOpen && (
        <div className="border-t border-zinc-200 bg-zinc-50">
          <form onSubmit={handleSearchSubmit} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coats, silk shirts, denim, ethnic wear..."
              className="flex-1 bg-white border border-zinc-300 px-3.5 py-2 text-sm text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950"
              autoFocus
            />
            <button
              type="submit"
              className="px-5 py-2 bg-zinc-950 text-white text-xs font-medium hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="px-3 py-2 text-xs text-zinc-600 hover:text-zinc-950"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-4 space-y-3">
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm font-medium text-zinc-800 border-b border-zinc-100"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="py-2 text-sm font-medium text-zinc-800 border-b border-zinc-100"
                >
                  Profile ({user.name})
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileOpen(false);
                    navigate('/');
                  }}
                  className="py-2 text-left text-sm font-medium text-red-600"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="inline-block text-center py-2.5 bg-zinc-950 text-white text-sm font-medium"
              >
                Sign In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
