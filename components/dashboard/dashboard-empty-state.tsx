type DashboardEmptyStateProps = {
  hasQuery: boolean;
  query: string;
};

export function DashboardEmptyState({ hasQuery, query }: DashboardEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-park-border bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-park-surface text-2xl text-park-blue">
        📋
      </div>
      <h3 className="text-lg font-bold text-park-navy">
        {hasQuery ? '검색 결과가 없습니다' : '표시할 설비가 없습니다'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasQuery
          ? `"${query}"에 맞는 Release Note 카드를 찾지 못했습니다. 검색어나 필터를 변경해 보세요.`
          : '새 카드 추가 버튼으로 Release Note 카드를 생성할 수 있습니다.'}
      </p>
    </div>
  );
}
