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
import type { HistoryRow } from '@/components/editor/types';

type HistorySectionProps = {
  history: HistoryRow[];
  readOnly: boolean;
  onAdd: () => void;
  onUpdate: (index: number, field: keyof HistoryRow, value: string) => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  onPrev: () => void;
  onNext: () => void;
};

export function HistorySection({
  history,
  readOnly,
  onAdd,
  onUpdate,
  onRemove,
  onSave,
  onPrev,
  onNext,
}: HistorySectionProps) {
  const fieldProps = readOnly ? { readOnly: true as const } : {};

  return (
    <section className={sectionCardClass}>
      <h2 className={sectionTitleClass}>🕘 업데이트 이력</h2>

      <div className="mb-4">
        <SectionAddButton label="+ 이력 추가" onClick={onAdd} readOnly={readOnly} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-park-border">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Date</th>
              <th className={thClass}>XEA Ver.</th>
              <th className={thClass}>XES Ver.</th>
              <th className={thClass}>CIM</th>
              <th className={thClass}>주요 변경 내용</th>
              <th className={thClass} />
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6} className={emptyTdClass}>
                  아직 등록된 업데이트 이력이 없습니다.
                </td>
              </tr>
            ) : (
              history.map((row, index) => (
                <tr key={index}>
                  <td className={tdClass}>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => onUpdate(index, 'date', e.target.value)}
                      className={cellInputClass}
                      {...fieldProps}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      value={row.xea}
                      onChange={(e) => onUpdate(index, 'xea', e.target.value)}
                      placeholder="예: 5.2.5 Dev3584"
                      className={cellInputClass}
                      {...fieldProps}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      value={row.xes}
                      onChange={(e) => onUpdate(index, 'xes', e.target.value)}
                      placeholder="예: 5.2.5 Dev1533"
                      className={cellInputClass}
                      {...fieldProps}
                    />
                  </td>
                  <td className={tdClass}>
                    <input
                      value={row.cim}
                      onChange={(e) => onUpdate(index, 'cim', e.target.value)}
                      placeholder="-"
                      className={cellInputClass}
                      {...fieldProps}
                    />
                  </td>
                  <td className={tdClass}>
                    <textarea
                      value={row.summary}
                      onChange={(e) => onUpdate(index, 'summary', e.target.value)}
                      placeholder="주요 변경 내용"
                      className={`${cellInputClass} min-h-[80px] resize-y`}
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
