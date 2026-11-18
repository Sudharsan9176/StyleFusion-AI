import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CartItem, CartSummary, WishlistItem } from '../types';
import { cartApi, extractErrorMessage, wishlistApi } from '../services/api';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface SessionPortrait {
  previewUrl: string;
  file: File | null;
  serverPath: string | null;
  fileName: string;
  dimensions: string;
}

interface StoreContextValue {
  cartItems: CartItem[];
  cartSummary: CartSummary;
  wishlistItems: WishlistItem[];
  wishlistIds: Set<number>;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  refreshCart: () => Promise<void>;
  refreshWishlist: () => Promise<void>;
  addToCart: (payload: {
    product_id: number;
    quantity?: number;
    selected_size: string;
    selected_color: string;
  }) => Promise<boolean>;
  updateCartItem: (
    cartItemId: number,
    payload: { quantity?: number; selected_size?: string; selected_color?: string }
  ) => Promise<void>;
  removeFromCart: (cartItemId: number) => Promise<void>;
  toggleWishlist: (productId: number) => Promise<void>;
  toasts: ToastMessage[];
  showToast: (text: string, type?: 'success' | 'error' | 'info') => void;
  dismissToast: (id: string) => void;
  sessionPortrait: SessionPortrait | null;
  setSessionPortrait: React.Dispatch<React.SetStateAction<SessionPortrait | null>>;
}

const emptySummary: CartSummary = {
  item_count: 0,
  subtotal: 0,
  discount: 0,
  shipping: 0,
  total: 0,
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartSummary, setCartSummary] = useState<CartSummary>(emptySummary);
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [sessionPortrait, setSessionPortrait] = useState<SessionPortrait | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, text }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast]
  );

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCartItems([]);
      setCartSummary(emptySummary);
      return;
    }
    try {
      const data = await cartApi.get();
      setCartItems(data.items);
      setCartSummary(data.summary);
    } catch {
      // ignore initial auth race
    }
  }, [user]);

  const refreshWishlist = useCallback(async () => {
    if (!user) {
      setWishlistItems([]);
      return;
    }
    try {
      const data = await wishlistApi.get();
      setWishlistItems(data.items);
    } catch {
      // ignore initial auth race
    }
  }, [user]);

  useEffect(() => {
    refreshCart();
    refreshWishlist();
  }, [refreshCart, refreshWishlist]);

  const addToCart = async (payload: {
    product_id: number;
    quantity?: number;
    selected_size: string;
    selected_color: string;
  }): Promise<boolean> => {
    if (!user) {
      showToast('Please sign in to add items to your bag.', 'info');
      return false;
    }
    try {
      const data = await cartApi.add(payload);
      setCartItems(data.items);
      setCartSummary(data.summary);
      setIsCartOpen(true);
      showToast('Added to shopping bag.', 'success');
      return true;
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to add item to bag.'), 'error');
      return false;
    }
  };

  const updateCartItem = async (
    cartItemId: number,
    payload: { quantity?: number; selected_size?: string; selected_color?: string }
  ) => {
    try {
      const data = await cartApi.update(cartItemId, payload);
      setCartItems(data.items);
      setCartSummary(data.summary);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update bag item.'), 'error');
    }
  };

  const removeFromCart = async (cartItemId: number) => {
    try {
      const data = await cartApi.remove(cartItemId);
      setCartItems(data.items);
      setCartSummary(data.summary);
      showToast('Removed from bag.', 'info');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to remove item.'), 'error');
    }
  };

  const wishlistIds = new Set(wishlistItems.map((item) => item.product.id));

  const toggleWishlist = async (productId: number) => {
    if (!user) {
      showToast('Please sign in to save items to your wishlist.', 'info');
      return;
    }
    try {
      if (wishlistIds.has(productId)) {
        await wishlistApi.remove(productId);
        await refreshWishlist();
        showToast('Removed from wishlist.', 'info');
      } else {
        await wishlistApi.add(productId);
        await refreshWishlist();
        showToast('Saved to wishlist.', 'success');
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Could not update wishlist.'), 'error');
    }
  };

  return (
    <StoreContext.Provider
      value={{
        cartItems,
        cartSummary,
        wishlistItems,
        wishlistIds,
        isCartOpen,
        setIsCartOpen,
        refreshCart,
        refreshWishlist,
        addToCart,
        updateCartItem,
        removeFromCart,
        toggleWishlist,
        toasts,
        showToast,
        dismissToast,
        sessionPortrait,
        setSessionPortrait,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
