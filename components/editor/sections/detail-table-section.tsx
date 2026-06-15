import {
  btnDanger,
  cellInputClass,
  emptyTdClass,
  sectionCardClass,
  sectionTitleClass,
  tableClass,
  tdClass,
  thClass,
} from '@/components/forms/form-classes';
import { SectionAddButton, SectionNavFooter } from '@/components/editor/section-nav-footer';
import type { DetailRow } from '@/components/editor/types';

type DetailTableSectionProps = {
  title: string;
  emptyMessage: string;
  rows: DetailRow[];
  readOnly: boolean;
  refPlaceholder?: string;
  titlePlaceholder?: string;
  descPlaceholder?: string;
  onAdd: () => void;
  onUpdate: (index: number, field: keyof DetailRow, value: string) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function DetailTableSection({
  title,
  emptyMessage,
  rows,
  readOnly,
  refPlaceholder = '예: PMS #4100',
  titlePlaceholder = '항목 제목',
  descPlaceholder = '고객용 설명',
  onAdd,
  onUpdate,
  onRemove,
  onSave,
  onPrev,
  onNext,
}: DetailTableSectionProps) {
  const fieldProps = readOnly ? { readOnly: true as const } : {};

  return (
    <section className={sectionCardClass}>
      <h2 className={sectionTitleClass}>{title}</h2>

      <div className="mb-4">
        <SectionAddButton label="+ 항목 추가" onClick={onAdd} readOnly={readOnly} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-park-border">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Reference</th>
              <th className={thClass}>Category</th>
              <th className={thClass}>Item</th>
              <th className={thClass}>Description</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={emptyTdClass}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={index}>
                  <td className={tdClass}>
                    <input
                      value={row.ref}
                      onChange={(e) => onUpdate(index, 'ref', e.target.value)}
                      placeholder={refPlaceholder}
                      className={cellInputClass}
                      {...fieldProps}
                    />
                  </td>
                  <td className={tdClass}>
                    <select
                      value={row.category}
                      onChange={(e) => onUpdate(index, 'category', e.target.value)}
                      className={cellInputClass}
                      disabled={readOnly}
                    >
                      <option value="New Feature">New Feature</option>
                      <option value="Improvement">Improvement</option>
                      <option value="Bug Fix">Bug Fix</option>
                    </select>
                  </td>
                  <td className={tdClass}>
                    <input
                      value={row.title}
                      onChange={(e) => onUpdate(index, 'title', e.target.value)}
                      placeholder={titlePlaceholder}
                      className={cellInputClass}
                      {...fieldProps}
                    />
                  </td>
                  <td className={tdClass}>
                    <textarea
                      value={row.desc}
                      onChange={(e) => onUpdate(index, 'desc', e.target.value)}
                      placeholder={descPlaceholder}
                      className={`${cellInputClass} min-h-[70px] resize-y`}
                      {...fieldProps}
                    />
                  </td>
                  <td className={tdClass}>
                    <button
                      type="button"
                      onClick={() => onRemove(index)}
                      disabled={readOnly}
                      className={btnDanger}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SectionNavFooter readOnly={readOnly} onPrev={onPrev} onSave={onSave} onNext={onNext} />
    </section>
  );
}
