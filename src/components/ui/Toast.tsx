import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let toastId = 0;

// Singleton toast state — kept outside React so it can be called anywhere
type ToastListener = (toasts: ToastItem[]) => void;
const listeners: ToastListener[] = [];
let toasts: ToastItem[] = [];

function notify(toastItem: ToastItem) {
  toasts = [...toasts, toastItem];
  listeners.forEach(l => l(toasts));

  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== toastItem.id);
    listeners.forEach(l => l(toasts));
  }, 3500);
}

export const toast = {
  success: (message: string) => notify({ id: ++toastId, type: 'success', message }),
  error: (message: string) => notify({ id: ++toastId, type: 'error', message }),
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  // Register listener on mount
  useState(() => {
    listeners.push(setItems);
    return () => {
      const idx = listeners.indexOf(setItems);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  });

  const dismiss = useCallback((id: number) => {
    toasts = toasts.filter(t => t.id !== id);
    setItems([...toasts]);
  }, []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
      {items.map(item => (
        <div
          key={item.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium min-w-[240px] max-w-sm animate-in slide-in-from-bottom-2 duration-200',
            item.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-300'
              : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300'
          )}
        >
          {item.type === 'success'
            ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
            : <AlertCircle className="w-4 h-4 flex-shrink-0" />
          }
          <span className="flex-1">{item.message}</span>
          <button
            onClick={() => dismiss(item.id)}
            className="p-0.5 hover:opacity-70 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}
