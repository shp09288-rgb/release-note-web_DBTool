type NoteModalProps = {
  open: boolean;
  title: string;
  description: string;
  site: string;
  equipment: string;
  onSiteChange: (value: string) => void;
  onEquipmentChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
};

export function NoteModal({
  open,
  title,
  description,
  site,
  equipment,
  onSiteChange,
  onEquipmentChange,
  onClose,
  onSubmit,
  submitLabel,
}: NoteModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-modal-title"
        className="w-full max-w-md rounded-2xl border border-park-border bg-white p-6 shadow-xl"
      >
        <h2 id="note-modal-title" className="text-xl font-extrabold text-park-navy">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Site</span>
            <input
              value={site}
              onChange={(e) => onSiteChange(e.target.value)}
              placeholder="예: SDC_A6"
              className="w-full rounded-xl border border-park-border px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-park-blue focus:ring-2 focus:ring-park-blue/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Equipment</span>
            <input
              value={equipment}
              onChange={(e) => onEquipmentChange(e.target.value)}
              placeholder="예: EQ01"
              className="w-full rounded-xl border border-park-border px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-park-blue focus:ring-2 focus:ring-park-blue/20"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-park-border bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-park-surface"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="rounded-xl bg-park-blue px-4 py-2.5 text-sm font-bold text-white hover:brightness-105"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
