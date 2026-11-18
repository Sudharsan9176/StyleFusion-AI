import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export function ToastContainer() {
  const { toasts, dismissToast } = useStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 px-4 py-3 border shadow-sm transition-all duration-150 ${
            toast.type === 'error'
              ? 'bg-zinc-950 text-white border-zinc-800'
              : toast.type === 'info'
              ? 'bg-white text-zinc-900 border-zinc-300'
              : 'bg-zinc-950 text-white border-zinc-900'
          }`}
        >
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />}
          <p className="text-xs leading-relaxed flex-1">{toast.text}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
