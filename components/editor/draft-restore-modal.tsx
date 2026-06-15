import { formatDraftSavedAt } from '@/lib/release-note-draft';
import { btnOutline, btnPrimary } from '@/components/forms/form-classes';

type DraftRestoreModalProps = {
  open: boolean;
  savedAt: string;
  displaySite: string;
  equipment: string;
  onRestore: () => void;
  onDiscard: () => void;
};

export function DraftRestoreModal({
  open,
  savedAt,
  displaySite,
  equipment,
  onRestore,
  onDiscard,
}: DraftRestoreModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-restore-modal-title"
        className="w-full max-w-md rounded-2xl border border-park-border bg-white p-6 shadow-xl"
      >
        <h2 id="draft-restore-modal-title" className="text-xl font-extrabold text-park-navy">
          임시 저장본 발견
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          이전에 작성하던 내용이 브라우저에 임시 저장되어 있습니다.
          <br />
          <span className="font-semibold text-slate-800">
            {displaySite} · {equipment}
          </span>
        </p>
        <p className="mt-3 rounded-xl bg-park-surface px-3 py-2 text-xs text-slate-600">
          임시 저장 시각: {formatDraftSavedAt(savedAt)}
        </p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onDiscard} className={btnOutline}>
            삭제하고 서버 내용 유지
          </button>
          <button type="button" onClick={onRestore} className={btnPrimary}>
            임시 저장본 복원
          </button>
        </div>
      </div>
    </div>
  );
}
