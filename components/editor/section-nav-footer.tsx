import type { ReactNode } from 'react';
import { btnOutline, btnPrimary, btnSecondary } from '@/components/forms/form-classes';

type SectionNavFooterProps = {
  readOnly: boolean;
  onPrev?: () => void;
  onSave: () => void;
  onNext?: () => void;
  prevLabel?: string;
  nextLabel?: string;
  extra?: ReactNode;
};

export function SectionNavFooter({
  readOnly,
  onPrev,
  onSave,
  onNext,
  prevLabel = '◀ 이전',
  nextLabel = '다음 ▶',
  extra,
}: SectionNavFooterProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex flex-wrap gap-2 border-t border-park-border bg-white/95 px-5 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
      {onPrev ? (
        <button type="button" onClick={onPrev} className={btnSecondary}>
          {prevLabel}
        </button>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        disabled={readOnly}
        title={readOnly ? '다른 사용자가 수정 중입니다' : undefined}
        className={btnPrimary}
      >
        현재 내용 저장
      </button>

      {extra}

      {onNext ? (
        <button type="button" onClick={onNext} className={`${btnSecondary} ml-auto`}>
          {nextLabel}
        </button>
      ) : null}
    </div>
  );
}

export function SectionAddButton({
  label,
  onClick,
  readOnly,
}: {
  label: string;
  onClick: () => void;
  readOnly: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={readOnly} className={btnOutline}>
      {label}
    </button>
  );
}
