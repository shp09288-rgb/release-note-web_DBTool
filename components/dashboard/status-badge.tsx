import type { DisplayStatus } from './types';

const STATUS_MAP: Record<
  DisplayStatus,
  { text: string; className: string }
> = {
  editable: {
    text: '편집 가능',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  locked: {
    text: '수정 중',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  stale_lock: {
    text: 'Stale Lock',
    className: 'bg-red-50 text-red-700 ring-red-200',
  },
  no_data: {
    text: '데이터 없음',
    className: 'bg-slate-100 text-slate-600 ring-slate-200',
  },
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const item = STATUS_MAP[status] ?? STATUS_MAP.no_data;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${item.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {item.text}
    </span>
  );
}
