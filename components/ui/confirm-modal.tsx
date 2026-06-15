'use client';

import { useEffect, useRef } from 'react';
import {
  ModalShell,
  modalBtnCancel,
  modalBtnDanger,
  modalBtnPrimary,
} from '@/components/ui/modal-shell';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
  highlight?: { label: string; value: string };
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  highlight,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  const confirmClass = variant === 'danger' ? modalBtnDanger : modalBtnPrimary;

  return (
    <ModalShell
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalBtnCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={confirmClass}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {highlight ? (
        <div className="rounded-xl border border-park-border bg-park-surface px-4 py-3 text-sm">
          <p className="font-bold text-park-navy">{highlight.label}</p>
          <p className="mt-1 font-semibold text-slate-800">{highlight.value}</p>
        </div>
      ) : null}
    </ModalShell>
  );
}
