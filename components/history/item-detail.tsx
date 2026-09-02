import type { DeploymentItemRow } from '@/lib/queries/types';

const PMS_BASE = 'https://pms.parksystems.com';

export function ItemDetail({ item }: { item: DeploymentItemRow }) {
  return (
    <div className="border-t border-park-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        {item.pms_no ? (
          <a
            href={`${PMS_BASE}/issues/${item.pms_no}`}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-park-navy hover:bg-slate-200"
          >
            PMS #{item.pms_no}
          </a>
        ) : null}
        {item.flags.includes('not_applied') ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            미적용
          </span>
        ) : null}
        <span className="text-xs text-slate-400">{item.section}</span>
      </div>

      <h4 className="mt-2 font-semibold text-slate-800">{item.title}</h4>

      {item.phenomenon ? (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
          <span className="font-semibold text-slate-500">현상 </span>
          {item.phenomenon}
        </p>
      ) : null}

      {item.improvements.map((group) => (
        <div key={group.component} className="mt-3">
          <span className="rounded bg-park-navy px-2 py-0.5 text-xs font-bold uppercase text-white">
            {group.component}
          </span>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {group.lines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
