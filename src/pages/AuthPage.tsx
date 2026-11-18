import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

export function AuthPage({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const { login, register } = useAuth();
  const { showToast } = useStore();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const loggedUser = await login(email, password);
        showToast(`Welcome back, ${loggedUser.name.split(' ')[0]}.`, 'success');
        navigate(loggedUser.role === 'admin' ? '/admin' : '/');
      } else {
        const createdUser = await register({ name, email, password, phone, address });
        showToast(`Account created. Welcome, ${createdUser.name.split(' ')[0]}.`, 'success');
        navigate('/');
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Authentication failed.'));
    } finally {
      setSubmitting(false);
    }
  };

  const fillSeededAccount = (role: 'customer' | 'admin') => {
    setMode('login');
    setError(null);
    if (role === 'admin') {
      setEmail('admin@ateliervera.com');
      setPassword('Admin@1234');
    } else {
      setEmail('claire@ateliervera.com');
      setPassword('Customer@1234');
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-14 sm:py-20">
      <div className="border border-zinc-200 bg-white p-8">
        <div className="flex border-b border-zinc-200 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition-colors ${
              mode === 'login' ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-500'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition-colors ${
              mode === 'register' ? 'border-zinc-950 text-zinc-950' : 'border-transparent text-zinc-500'
            }`}
          >
            Create Account
          </button>
        </div>

        <h1 className="font-editorial text-3xl font-semibold text-zinc-950">
          {mode === 'login' ? 'Welcome Back' : 'Join Atelier Vera'}
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          {mode === 'login'
            ? 'Access your saved wishlist, virtual try-on history, and orders.'
            : 'Create an account to shop, track orders, and try outfits with AI.'}
        </p>

        {error && (
          <div className="mt-4 p-3 border border-red-200 bg-red-50 text-xs text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Claire Laurent"
                className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Minimum 8 characters' : '••••••••'}
              className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Phone (Optional)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 234-5678"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Delivery Address (Optional)</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="42 Mercer Street, New York, NY"
                  className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-zinc-950 text-white text-xs font-semibold tracking-wide hover:bg-zinc-800 disabled:opacity-50"
          >
            {submitting
              ? mode === 'login'
                ? 'Signing In...'
                : 'Creating Account...'
              : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>
        </form>

        {/* Quick Seeded Account Helpers */}
        <div className="mt-6 pt-5 border-t border-zinc-200 space-y-2">
          <p className="text-[11px] font-medium text-zinc-500">Seeded Accounts (SQLite):</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillSeededAccount('customer')}
              className="py-2 px-3 border border-zinc-200 hover:border-zinc-950 text-[11px] font-medium text-zinc-800 text-left"
            >
              <span className="block font-semibold">Customer</span>
              <span className="text-zinc-500">claire@ateliervera.com</span>
            </button>
            <button
              type="button"
              onClick={() => fillSeededAccount('admin')}
              className="py-2 px-3 border border-zinc-200 hover:border-zinc-950 text-[11px] font-medium text-zinc-800 text-left"
            >
              <span className="block font-semibold">Admin</span>
              <span className="text-zinc-500">admin@ateliervera.com</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
