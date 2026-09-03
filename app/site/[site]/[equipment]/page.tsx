import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTimeline } from '@/lib/queries/deployments';
import { getCachedIssues } from '@/lib/queries/pms';
import { findGaps } from '@/lib/timeline';
import { DeploymentTimeline } from '@/components/history/deployment-timeline';

export const dynamic = 'force-dynamic';

// Next.js 16: params 는 Promise 다.
export default async function SiteTimelinePage({
  params,
}: {
  params: Promise<{ site: string; equipment: string }>;
}) {
  const { site: rawSite, equipment: rawEquipment } = await params;
  const site = decodeURIComponent(rawSite);
  const equipment = decodeURIComponent(rawEquipment);

  const deployments = await getTimeline(site, equipment);
  if (deployments.length === 0) notFound();

  const gaps = findGaps(deployments);

  const pmsNumbers = deployments.flatMap((d) =>
    d.items.map((i) => i.pms_no).filter((n): n is number => n != null)
  );
  const issues = await getCachedIssues(pmsNumbers);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-park-muted hover:underline">
        ← 설비 목록
      </Link>

      <header className="mb-8 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">
          {site} / {equipment}
        </h1>
        <p className="mt-1 text-sm text-park-muted">
          배포 {deployments.length}건
          {gaps.length > 0 ? ` · 기록 누락 구간 ${gaps.length}곳` : ''}
        </p>
      </header>

      <DeploymentTimeline
        deployments={deployments}
        gaps={gaps}
        issues={Object.fromEntries(issues)}
      />
    </main>
  );
}
