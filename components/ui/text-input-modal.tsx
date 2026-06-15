'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ModalShell,
  modalBtnCancel,
  modalBtnPrimary,
  modalInputClass,
  modalLabelClass,
} from '@/components/ui/modal-shell';

type TextInputModalProps = {
  open: boolean;
  title: string;
  description: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

export function TextInputModal({
  open,
  title,
  description,
  label,
  defaultValue = '',
  placeholder,
  submitLabel = '확인',
  onSubmit,
  onCancel,
}: TextInputModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      setValue(defaultValue);
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open, defaultValue]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(value);
  };

  return (
    <ModalShell
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalBtnCancel}>
            취소
          </button>
          <button type="submit" form="text-input-modal-form" className={modalBtnPrimary}>
            {submitLabel}
          </button>
        </>
      }
    >
      <form id="text-input-modal-form" onSubmit={handleSubmit}>
        <label className="block">
          <span className={modalLabelClass}>{label}</span>
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={placeholder}
            className={modalInputClass}
            autoComplete="username"
          />
        </label>
      </form>
    </ModalShell>
  );
}
