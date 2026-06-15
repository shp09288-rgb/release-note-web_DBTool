'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ModalShell,
  modalBtnCancel,
  modalBtnPrimary,
  modalInputClass,
  modalLabelClass,
} from '@/components/ui/modal-shell';

type ChangePasswordModalProps = {
  open: boolean;
  title?: string;
  description?: string;
  submitting?: boolean;
  onSubmit: (payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => void;
  onCancel: () => void;
};

export function ChangePasswordModal({
  open,
  title = '비밀번호 변경',
  description = '대시보드 보호 비밀번호를 변경합니다.',
  submitting = false,
  onSubmit,
  onCancel,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit({ currentPassword, newPassword, confirmPassword });
  };

  return (
    <ModalShell
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <button type="button" onClick={onCancel} className={modalBtnCancel} disabled={submitting}>
            취소
          </button>
          <button
            type="submit"
            form="change-password-modal-form"
            className={modalBtnPrimary}
            disabled={submitting}
          >
            {submitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </>
      }
    >
      <form id="change-password-modal-form" className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className={modalLabelClass}>현재 비밀번호</span>
          <input
            ref={inputRef}
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={modalInputClass}
            autoComplete="current-password"
            disabled={submitting}
          />
        </label>

        <label className="block">
          <span className={modalLabelClass}>새 비밀번호</span>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={modalInputClass}
            autoComplete="new-password"
            disabled={submitting}
          />
        </label>

        <label className="block">
          <span className={modalLabelClass}>새 비밀번호 확인</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={modalInputClass}
            autoComplete="new-password"
            disabled={submitting}
          />
        </label>
      </form>
    </ModalShell>
  );
}
