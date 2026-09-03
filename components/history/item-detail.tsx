import type { DeploymentItemRow } from '@/lib/queries/types';
import type { PmsIssueRow } from '@/lib/queries/pms';

const PMS_BASE = 'https://pms.parksystems.com';

export function ItemDetail({
  item,
  issue,
  siteName,
}: {
  item: DeploymentItemRow;
  issue?: PmsIssueRow;
  siteName: string;
}) {
  return (
    <div className="border-t border-park-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        {item.pms_no ? (
          <a
            href={`${PMS_BASE}/issues/${item.pms_no}`}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-park-surface px-2 py-0.5 text-xs font-bold text-park-navy hover:bg-park-border"
          >
            PMS #{item.pms_no}
          </a>
        ) : null}
        {item.flags.includes('not_applied') ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            미적용
          </span>
        ) : null}
        <span className="text-xs text-park-muted">{item.section}</span>
      </div>

      {issue ? (
        <p className="mt-1 text-xs text-park-muted">
          {issue.status}
          {issue.assignee ? ` · ${issue.assignee}` : ''}
          {issue.origin_site && issue.origin_site !== siteName
            ? ` · 최초 발생 ${issue.origin_site}`
            : ''}
        </p>
      ) : null}

      <h4 className="mt-2 font-semibold text-park-ink">{item.title}</h4>

      {item.phenomenon ? (
        <p className="mt-2 whitespace-pre-line text-sm text-park-ink">
          <span className="font-semibold text-park-muted">현상 </span>
          {item.phenomenon}
        </p>
      ) : null}

      {item.improvements.map((group) => (
        <div key={group.component} className="mt-3">
          <span className="rounded bg-park-navy px-2 py-0.5 text-xs font-bold uppercase text-white">
            {group.component}
          </span>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-park-ink">
            {group.lines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
