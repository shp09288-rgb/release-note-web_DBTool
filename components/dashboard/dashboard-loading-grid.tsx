export function DashboardLoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-park-border bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="h-6 w-20 rounded-full bg-slate-200" />
          </div>
          <div className="space-y-2 border-t border-park-border pt-4">
            {Array.from({ length: 4 }).map((__, row) => (
              <div key={row} className="h-3 rounded bg-slate-100" />
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <div className="h-9 flex-1 rounded-xl bg-slate-100" />
            <div className="h-9 flex-1 rounded-xl bg-slate-100" />
            <div className="h-9 flex-1 rounded-xl bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
