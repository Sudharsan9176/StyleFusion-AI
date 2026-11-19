import React from 'react';
import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="border-t border-zinc-200 bg-white mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <span className="font-editorial text-2xl font-semibold text-zinc-950">StyleFusion AI</span>
            <p className="mt-3 text-sm text-zinc-500 max-w-md leading-relaxed">
              Contemporary architectural tailoring and natural-fiber wardrobe essentials, paired with live Hugging Face
              AI Virtual Try-On so you can verify proportion and drape before ordering.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-950 tracking-wide mb-4">Collection</h3>
            <ul className="space-y-2.5 text-sm text-zinc-600">
              <li>
                <Link to="/shop" className="hover:text-zinc-950 transition-colors">
                  All Garments
                </Link>
              </li>
              <li>
                <Link to="/shop?category=Outerwear" className="hover:text-zinc-950 transition-colors">
                  Outerwear &amp; Jackets
                </Link>
              </li>
              <li>
                <Link to="/shop?category=Dresses" className="hover:text-zinc-950 transition-colors">
                  Dresses &amp; Tailoring
                </Link>
              </li>
              <li>
                <Link to="/tryon" className="hover:text-zinc-950 transition-colors">
                  Virtual Try-On Studio
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-zinc-950 tracking-wide mb-4">Client Services</h3>
            <ul className="space-y-2.5 text-sm text-zinc-600">
              <li>
                <Link to="/orders" className="hover:text-zinc-950 transition-colors">
                  Order Tracking
                </Link>
              </li>
              <li>
                <Link to="/wishlist" className="hover:text-zinc-950 transition-colors">
                  Saved Wishlist
                </Link>
              </li>
              <li>
                <Link to="/profile" className="hover:text-zinc-950 transition-colors">
                  Account Profile
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-zinc-950 transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} StyleFusion AI. All rights reserved.</p>
          <p>Complimentary express shipping on orders over $250 · Cash on Delivery &amp; Card Checkout</p>
        </div>
      </div>
    </footer>
  );
}
