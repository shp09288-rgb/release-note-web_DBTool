import Link from 'next/link';
import type { EquipmentSummary } from '@/lib/queries/types';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}

export function EquipmentSummaryCard({ item }: { item: EquipmentSummary }) {
  const href = `/site/${encodeURIComponent(item.site)}/${encodeURIComponent(item.equipment)}`;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl border border-park-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold text-park-navy">
            {item.site} / {item.equipment}
          </h2>
          <p className="mt-1 truncate text-sm text-slate-500">{item.model || '모델 미상'}</p>
        </div>
        {item.notAppliedCount > 0 ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            미적용 {item.notAppliedCount}
          </span>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-park-border pt-4">
        <MetaRow label="최근 배포" value={item.latestDeployedOn ?? '-'} />
        <MetaRow label="XEA" value={item.xeaToRaw || '-'} />
        <MetaRow label="XES" value={item.xesToRaw || '-'} />
        <MetaRow label="배포 이력" value={`${item.deploymentCount}건`} />
      </div>
    </Link>
  );
}
