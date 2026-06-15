import { StatCard } from './stat-card';
import type { StatusFilter } from './types';

type DashboardStatsProps = {
  total: number;
  editable: number;
  locked: number;
  noData: number;
  statusFilter: StatusFilter;
  onFilterSelect: (filter: StatusFilter) => void;
};

export function DashboardStats({
  total,
  editable,
  locked,
  noData,
  statusFilter,
  onFilterSelect,
}: DashboardStatsProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard
        label="전체 설비"
        value={total}
        accentClass="text-park-navy"
        onClick={() => onFilterSelect('all')}
        active={statusFilter === 'all'}
      />
      <StatCard
        label="편집 가능"
        value={editable}
        accentClass="text-emerald-600"
        onClick={() => onFilterSelect('editable')}
        active={statusFilter === 'editable'}
      />
      <StatCard
        label="잠금"
        value={locked}
        accentClass="text-orange-600"
        onClick={() => onFilterSelect('locked')}
        active={statusFilter === 'locked'}
      />
      <StatCard
        label="데이터 없음"
        value={noData}
        accentClass="text-slate-500"
        onClick={() => onFilterSelect('no_data')}
        active={statusFilter === 'no_data'}
      />
    </section>
  );
}
