'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ModalShell,
  modalBtnCancel,
  modalBtnPrimary,
  modalInputClass,
  modalLabelClass,
} from '@/components/ui/modal-shell';

type PasswordModalProps = {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  submitLabel?: string;
  submitting?: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
};

export function PasswordModal({
  open,
  title,
  description,
  actionLabel,
  submitLabel = '확인',
  submitting = false,
  onSubmit,
  onCancel,
}: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      setPassword('');
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(password);
  };

  return (
    <ModalShell
      open={open}
      title={title}
      description={description || `${actionLabel}하려면 비밀번호를 입력하세요.`}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalBtnCancel} disabled={submitting}>
            취소
          </button>
          <button
            type="submit"
            form="password-modal-form"
            className={modalBtnPrimary}
            disabled={submitting}
          >
            {submitting ? '확인 중...' : submitLabel}
          </button>
        </>
      }
    >
      <form id="password-modal-form" onSubmit={handleSubmit}>
        <label className="block">
          <span className={modalLabelClass}>비밀번호</span>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호 입력"
            className={modalInputClass}
            autoComplete="current-password"
            disabled={submitting}
          />
        </label>
      </form>
    </ModalShell>
  );
}
