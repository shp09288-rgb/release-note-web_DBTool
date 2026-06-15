import type { SortKey, StatusFilter } from './types';

type DashboardToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
};

const selectClassName =
  'w-full rounded-xl border border-park-border bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-park-blue focus:ring-2 focus:ring-park-blue/20';

export function DashboardToolbar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  sortKey,
  onSortKeyChange,
}: DashboardToolbarProps) {
  return (
    <section className="rounded-2xl border border-park-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_160px_180px] lg:items-center">
        <label className="relative block">
          <span className="sr-only">검색</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm10 2-4.3-4.3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Site, Equipment, 수정자 검색 (예: A6, EQ01, user1)"
            className="w-full rounded-xl border border-park-border bg-park-surface py-3 pl-10 pr-10 text-sm text-slate-700 outline-none transition focus:border-park-blue focus:bg-white focus:ring-2 focus:ring-park-blue/20"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
              aria-label="검색어 지우기"
            >
              ✕
            </button>
          ) : null}
        </label>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          className={selectClassName}
          aria-label="상태 필터"
        >
          <option value="all">상태: 전체</option>
          <option value="editable">편집 가능</option>
          <option value="locked">수정 중</option>
          <option value="stale_lock">Stale Lock</option>
          <option value="no_data">데이터 없음</option>
        </select>

        <select
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as SortKey)}
          className={selectClassName}
          aria-label="정렬"
        >
          <option value="recent">정렬: 최근 수정순</option>
          <option value="site">정렬: Site순</option>
          <option value="equipment">정렬: Equipment순</option>
        </select>
      </div>
    </section>
  );
}
