import { StatusBadge } from './status-badge';
import type { Item } from './types';
import { resolveDisplayStatus } from './types';

type EquipmentCardProps = {
  item: Item;
  onOpen: () => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
};

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}

export function EquipmentCard({ item, onOpen, onEdit, onDelete }: EquipmentCardProps) {
  const displayStatus = resolveDisplayStatus(item);
  const updatedLabel = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '-';

  return (
    <article
      onClick={onOpen}
      className="group flex h-full cursor-pointer flex-col rounded-2xl border border-park-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold text-park-navy">
            {item.site} / {item.equipment}
          </h2>
          <p className="mt-1 truncate text-sm text-slate-500">
            {item.site} · {item.equipment}
          </p>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      <div className="space-y-2 border-t border-park-border pt-4">
        <MetaRow label="최신 수정" value={updatedLabel} />
        <MetaRow label="릴리즈 날짜" value={item.date || '-'} />
        <MetaRow label="XEA" value={item.xeaAfter || '-'} />
        <MetaRow label="XES" value={item.xesAfter || '-'} />

        {displayStatus === 'locked' || displayStatus === 'stale_lock' ? (
          <>
            <MetaRow label="수정 중 사용자" value={item.lockUser || '-'} />
            <MetaRow
              label="잠금 시각"
              value={item.lockUpdatedAt ? new Date(item.lockUpdatedAt).toLocaleString() : '-'}
            />
          </>
        ) : null}

        <MetaRow
          label="latest.json"
          value={displayStatus === 'no_data' ? '없음' : '있음'}
        />
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap sm:justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item);
          }}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100"
        >
          삭제
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          className="rounded-xl border border-park-border bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-park-surface"
        >
          수정
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="rounded-xl bg-park-blue px-4 py-2 text-sm font-bold text-white transition hover:brightness-105 sm:ml-auto"
        >
          바로 열기
        </button>
      </div>
    </article>
  );
}
