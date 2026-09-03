'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DeploymentWithItems } from '@/lib/queries/types';
import type { TimelineGap } from '@/lib/timeline';
import type { PmsIssueRow } from '@/lib/queries/pms';
import { ItemDetail } from './item-detail';

function VersionArrow({ from, to }: { from: string; to: string }) {
  if (!from && !to) return <span className="text-slate-400">-</span>;
  if (!from) return <span className="font-mono text-sm">{to}</span>;
  return (
    <span className="font-mono text-sm">
      {from} <span className="text-slate-400">→</span> {to}
    </span>
  );
}

function GapNotice({ gap }: { gap: TimelineGap }) {
  return (
    <div className="my-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">
      {gap.component.toUpperCase()} Dev{gap.fromBuild} ~ Dev{gap.toBuild} 구간의 배포 기록이
      없습니다.
    </div>
  );
}

export function DeploymentTimeline({
  deployments,
  gaps,
  issues,
}: {
  deployments: DeploymentWithItems[];
  gaps: TimelineGap[];
  issues: Record<number, PmsIssueRow>;
}) {
  const [open, setOpen] = useState<string | null>(deployments[0]?.id ?? null);
  const siteName = deployments[0]?.site ?? '';

  return (
    <ol className="space-y-3">
      {deployments.map((dep) => {
        const isOpen = open === dep.id;
        const isLegacy = dep.source_kind === 'legacy_json';
        const hasItems = dep.items.length > 0;
        const gapsAfter = gaps.filter((g) => g.newerId === dep.id);

        return (
          <li key={dep.id}>
            {gapsAfter.map((gap) => (
              <GapNotice key={`${gap.component}-${gap.newerId}`} gap={gap} />
            ))}

            <article className="rounded-2xl border border-park-border bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : dep.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-park-navy">{dep.deployed_on ?? '날짜 미상'}</span>
                    {isLegacy ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        과거 기록
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-0.5 text-slate-600">
                    <div>
                      <span className="mr-2 text-xs text-slate-400">XEA</span>
                      <VersionArrow from={dep.xea_from_raw} to={dep.xea_to_raw} />
                    </div>
                    <div>
                      <span className="mr-2 text-xs text-slate-400">XES</span>
                      <VersionArrow from={dep.xes_from_raw} to={dep.xes_to_raw} />
                    </div>
                  </div>
                </div>
                <span className="text-sm text-slate-500">
                  {hasItems ? `${dep.items.length}개 항목` : '요약만'}
                </span>
              </button>

              {isOpen ? (
                <div className="px-5 pb-5">
                  {!hasItems ? (
                    <p className="whitespace-pre-line border-t border-park-border pt-4 text-sm text-slate-600">
                      {dep.body_text || '내용 없음'}
                    </p>
                  ) : (
                    <>
                      {dep.items.map((item) => (
                        <ItemDetail
                          key={item.id}
                          item={item}
                          issue={item.pms_no != null ? issues[item.pms_no] : undefined}
                          siteName={siteName}
                        />
                      ))}
                      <Link
                        href={`/deployment/${dep.id}`}
                        className="mt-4 inline-block text-sm font-semibold text-park-navy underline"
                      >
                        원문 문서 보기
                      </Link>
                    </>
                  )}
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
