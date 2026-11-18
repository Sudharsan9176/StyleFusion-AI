import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, extractErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const { showToast } = useStore();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [address, setAddress] = useState(user?.address || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <h1 className="font-editorial text-3xl font-semibold text-zinc-950">Account Profile</h1>
        <p className="text-sm text-zinc-500 mt-2">Sign in to view and manage your profile settings.</p>
        <Link to="/login" className="mt-6 inline-block px-6 py-3 bg-zinc-950 text-white text-xs font-semibold">
          Sign In
        </Link>
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: {
        name: string;
        phone: string;
        address: string;
        current_password?: string;
        new_password?: string;
      } = { name, phone, address };

      if (newPassword) {
        payload.current_password = currentPassword;
        payload.new_password = newPassword;
      }

      const res = await authApi.updateProfile(payload);
      setUser(res.user);
      setCurrentPassword('');
      setNewPassword('');
      showToast('Profile settings saved.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update profile.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="border-b border-zinc-200 pb-6">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Account Settings</p>
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-zinc-950 mt-1">{user.name}</h1>
        <p className="text-xs text-zinc-500 mt-1">
          {user.email} · Role: {user.role}
        </p>
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-6 border border-zinc-200 bg-white p-6 sm:p-8">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Default Shipping Address</label>
          <textarea
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
          />
        </div>

        <div className="pt-4 border-t border-zinc-200 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-900 font-sans">
            Change Password (Optional)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                className="w-full px-3.5 py-2 text-sm border border-zinc-300 focus:outline-none focus:border-zinc-950"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-zinc-950 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? 'Saving Changes...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
