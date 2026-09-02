import Link from 'next/link';
import { listEquipment } from '@/lib/queries/deployments';
import { EquipmentSummaryCard } from '@/components/history/equipment-summary-card';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const equipment = await listEquipment();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-park-navy">SW 버전 이력</h1>
          <p className="mt-1 text-sm text-slate-500">
            사이트별 SW 버전과 각 버전에 적용된 개선 내역
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/search"
            className="rounded-lg border border-park-border px-4 py-2 text-sm font-semibold text-park-navy hover:bg-slate-50"
          >
            PMS · 키워드 검색
          </Link>
          <Link
            href="/upload"
            className="rounded-lg bg-park-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            문서 업로드
          </Link>
        </div>
      </header>

      {equipment.length === 0 ? (
        <p className="rounded-2xl border border-park-border bg-white p-10 text-center text-slate-500">
          등록된 배포 이력이 없습니다.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((item) => (
            <EquipmentSummaryCard key={`${item.site}-${item.equipment}`} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
