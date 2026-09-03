import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDeployment } from '@/lib/queries/deployments';

export const dynamic = 'force-dynamic';

export default async function DeploymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deployment = await getDeployment(id);
  if (!deployment) notFound();

  const back = `/site/${encodeURIComponent(deployment.site)}/${encodeURIComponent(deployment.equipment)}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href={back} className="text-sm text-slate-500 hover:underline">
        ← {deployment.site} / {deployment.equipment} 타임라인
      </Link>

      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">
          {deployment.deployed_on ?? '날짜 미상'} 배포 원문
        </h1>
        <p className="mt-1 font-mono text-sm text-slate-500">
          XEA {deployment.xea_to_raw || '-'} · XES {deployment.xes_to_raw || '-'}
        </p>
      </header>

      {deployment.raw_html ? (
        // /upload 를 거쳐 저장된 값이라 신뢰할 수 있는 입력이 아니다.
        // sandbox="" 로 스크립트 실행·폼 제출·top-navigation 등 모든 권한을 차단한다.
        <iframe
          srcDoc={deployment.raw_html}
          title="배포 문서 원문"
          sandbox=""
          className="h-[80vh] w-full rounded-2xl border border-park-border bg-white"
        />
      ) : (
        <div className="rounded-2xl border border-park-border bg-white p-6">
          <p className="mb-3 text-sm text-slate-500">
            원문 문서가 없는 과거 기록입니다. 요약만 남아 있습니다.
          </p>
          <p className="whitespace-pre-line text-sm text-slate-700">
            {deployment.body_text || '내용 없음'}
          </p>
        </div>
      )}
    </main>
  );
}
