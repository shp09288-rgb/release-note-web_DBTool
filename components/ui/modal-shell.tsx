'use client';

import { useEffect, useId, type ReactNode } from 'react';

type ModalShellProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
  showLogo?: boolean;
};

export function ModalShell({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  showLogo = true,
}: ModalShellProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-3 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-park-border bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-park-border bg-gradient-to-r from-park-navy to-[#2E5FA3] px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/park-mascot.png"
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg bg-white/10 object-contain p-1"
                onError={(event) => {
                  event.currentTarget.src = '/park-logo.png';
                }}
              />
            ) : null}
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-extrabold sm:text-xl">
                {title}
              </h2>
              {description ? (
                <div className="mt-1 text-sm leading-relaxed text-blue-100">{description}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="p-5">{children}</div>

        <div className="flex flex-col-reverse gap-2 border-t border-park-border bg-park-surface/50 px-5 py-4 sm:flex-row sm:justify-end">
          {footer}
        </div>
      </div>
    </div>
  );
}

export const modalInputClass =
  'w-full rounded-xl border border-park-border bg-park-surface px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-park-blue focus:bg-white focus:ring-2 focus:ring-park-blue/20';

export const modalLabelClass = 'mb-1.5 block text-sm font-bold text-slate-700';

export const modalBtnCancel =
  'w-full rounded-xl border border-park-border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-park-surface sm:w-auto';

export const modalBtnPrimary =
  'w-full rounded-xl bg-park-navy px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto';

export const modalBtnDanger =
  'w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto';

export const modalBtnSecondary =
  'w-full rounded-xl bg-park-blue px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto';
