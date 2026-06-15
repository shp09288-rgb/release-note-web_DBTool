import {
  btnDanger,
  cellInputClass,
  sectionCardClass,
  sectionTitleClass,
} from '@/components/forms/form-classes';
import { SectionAddButton, SectionNavFooter } from '@/components/editor/section-nav-footer';
import type { NoteRow } from '@/components/editor/types';

type NotesSectionProps = {
  notes: NoteRow[];
  readOnly: boolean;
  onAdd: () => void;
  onUpdate: (index: number, field: keyof NoteRow, value: string) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function NotesSection({
  notes,
  readOnly,
  onAdd,
  onUpdate,
  onRemove,
  onSave,
  onPrev,
  onNext,
}: NotesSectionProps) {
  const fieldProps = readOnly ? { readOnly: true as const } : {};

  return (
    <section className={sectionCardClass}>
      <h2 className={sectionTitleClass}>📌 Important Notes</h2>

      <div className="mb-4">
        <SectionAddButton label="+ 항목 추가" onClick={onAdd} readOnly={readOnly} />
      </div>

      {notes.length === 0 ? (
        <div className="mb-4 rounded-xl border border-park-border bg-park-surface px-4 py-6 text-center text-sm text-slate-500">
          아직 등록된 Important Notes가 없습니다.
        </div>
      ) : (
        <div className="mb-4 space-y-3">
          {notes.map((row, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <select
                value={row.icon}
                onChange={(e) => onUpdate(index, 'icon', e.target.value)}
                className={`${cellInputClass} w-full sm:w-24`}
                disabled={readOnly}
              >
                <option value="!">[!]</option>
                <option value="i">[i]</option>
              </select>
              <textarea
                value={row.text}
                onChange={(e) => onUpdate(index, 'text', e.target.value)}
                placeholder="고객에게 전달할 중요 메모"
                className={`${cellInputClass} min-h-[80px] flex-1 resize-y`}
                {...fieldProps}
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={readOnly}
                className={`${btnDanger} shrink-0`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <SectionNavFooter readOnly={readOnly} onPrev={onPrev} onSave={onSave} onNext={onNext} />
    </section>
  );
}
