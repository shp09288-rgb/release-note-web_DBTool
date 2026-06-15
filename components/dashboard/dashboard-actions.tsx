type DashboardActionsProps = {
  onCreate: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
};

export function DashboardActions({ onCreate, onRefresh, refreshing }: DashboardActionsProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCreate}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-park-orange px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:brightness-105"
      >
        <span aria-hidden>+</span>
        새 카드 추가
      </button>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center justify-center rounded-xl border border-park-border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-park-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        {refreshing ? '불러오는 중…' : '새로고침'}
      </button>
    </div>
  );
}
