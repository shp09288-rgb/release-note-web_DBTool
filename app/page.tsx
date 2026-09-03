import { listEquipment } from '@/lib/queries/deployments';
import { EquipmentSummaryCard } from '@/components/history/equipment-summary-card';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const equipment = await listEquipment();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      {/* 검색·업로드 링크는 공통 헤더로 옮겼다. 여기서 중복하지 않는다. */}
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-park-navy">설비 목록</h1>
        <p className="mt-1 text-sm text-park-muted">
          사이트별 SW 버전과 각 버전에 적용된 개선 내역
        </p>
      </header>

      {equipment.length === 0 ? (
        <p className="rounded-2xl border border-park-border bg-white p-10 text-center text-park-muted">
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
