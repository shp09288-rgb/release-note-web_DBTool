'use client';

import { useEffect } from 'react';

export type ToastState = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

type DashboardToastProps = {
  toast: ToastState;
  onDismiss: () => void;
};

const STYLE_MAP = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

export function DashboardToast({ toast, onDismiss }: DashboardToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-sm">
      <div
        role="status"
        className={`rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${STYLE_MAP[toast.type]}`}
      >
        <div className="flex items-start justify-between gap-3">
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md px-1 text-base leading-none opacity-70 hover:opacity-100"
            aria-label="알림 닫기"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
