'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DetailCategory, DetailRow } from '@/components/editor/types';
import { btnDanger, cellInputClass } from '@/components/forms/form-classes';
import {
  applyGroupNameToRows,
  findDuplicateRefWarnings,
  parseBulkDetailText,
  type BulkParseWarning,
  type GroupNameApplyMode,
  type ParsedBulkRow,
} from '@/lib/release-note-bulk-parser';
import {
  ModalShell,
  modalBtnCancel,
  modalBtnPrimary,
  modalInputClass,
  modalLabelClass,
} from '@/components/ui/modal-shell';

type BulkDetailImportModalProps = {
  open: boolean;
  targetLabel: string;
  existingRows: DetailRow[];
  onClose: () => void;
  onApply: (rows: DetailRow[], warnings: BulkParseWarning[]) => void;
};

type Step = 'input' | 'preview';

const GROUP_MODE_OPTIONS: { value: GroupNameApplyMode; label: string }[] = [
  { value: 'desc-prefix', label: 'Description 첫 줄에 포함 (기본)' },
  { value: 'item-prefix', label: 'Item 앞에 포함' },
  { value: 'none', label: '저장하지 않음' },
];

export function BulkDetailImportModal({
  open,
  targetLabel,
  existingRows,
  onClose,
  onApply,
}: BulkDetailImportModalProps) {
  const [step, setStep] = useState<Step>('input');
  const [rawText, setRawText] = useState('');
  const [defaultCategory, setDefaultCategory] = useState<DetailCategory>('Improvement');
  const [previewRows, setPreviewRows] = useState<ParsedBulkRow[]>([]);
  const [parseWarnings, setParseWarnings] = useState<BulkParseWarning[]>([]);
  const [unclassifiedLines, setUnclassifiedLines] = useState<string[]>([]);
  const [summary, setSummary] = useState({
    pmsCount: 0,
    groupTitleCount: 0,
    descriptionLineCount: 0,
    relatedPmsCount: 0,
    unclassifiedCount: 0,
  });
  const [groupMode, setGroupMode] = useState<GroupNameApplyMode>('desc-prefix');
  const [applyWarnings, setApplyWarnings] = useState<BulkParseWarning[]>([]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      setStep('input');
      setRawText('');
      setDefaultCategory('Improvement');
      setPreviewRows([]);
      setParseWarnings([]);
      setUnclassifiedLines([]);
      setSummary({
        pmsCount: 0,
        groupTitleCount: 0,
        descriptionLineCount: 0,
        relatedPmsCount: 0,
        unclassifiedCount: 0,
      });
      setGroupMode('desc-prefix');
      setApplyWarnings([]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  const handleAnalyze = () => {
    const result = parseBulkDetailText({ text: rawText, defaultCategory });
    setPreviewRows(result.rows);
    setParseWarnings(result.warnings);
    setUnclassifiedLines(result.unclassifiedLines);
    setSummary(result.summary);
    setApplyWarnings([]);
    setStep('preview');
  };

  const handleApply = () => {
    const detailRows = applyGroupNameToRows(previewRows, groupMode);
    const duplicateWarnings = findDuplicateRefWarnings(existingRows, detailRows);
    setApplyWarnings(duplicateWarnings);
    if (detailRows.length === 0) return;
    onApply(detailRows, duplicateWarnings);
  };

  const allWarnings = useMemo(
    () => [...parseWarnings, ...applyWarnings],
    [parseWarnings, applyWarnings]
  );

  const updatePreviewRow = (index: number, field: keyof DetailRow, value: string) => {
    setPreviewRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
    setApplyWarnings([]);
  };

  const removePreviewRow = (index: number) => {
    setPreviewRows((prev) => prev.filter((_, i) => i !== index));
    setApplyWarnings([]);
  };

  const footer =
    step === 'input' ? (
      <>
        <button type="button" onClick={onClose} className={modalBtnCancel}>
          취소
        </button>
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!rawText.trim()}
          className={modalBtnPrimary}
        >
          내용 분석
        </button>
      </>
    ) : (
      <>
        <button type="button" onClick={() => setStep('input')} className={modalBtnCancel}>
          ◀ 원문 수정
        </button>
        <button type="button" onClick={onClose} className={modalBtnCancel}>
          취소
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={previewRows.length === 0}
          className={modalBtnPrimary}
        >
          {previewRows.length}개 항목 추가
        </button>
      </>
    );

  return (
    <ModalShell
      open={open}
      title="📋 일괄 붙여넣기"
      description={`${targetLabel} — Outlook에서 복사한 원문을 붙여넣으세요.`}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      footer={footer}
    >
      {step === 'input' ? (
        <div className="space-y-4">
          <label className="block">
            <span className={modalLabelClass}>원문</span>
            <textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder="PMS #4705 제목&#10;설명 줄..."
              className={`${modalInputClass} min-h-[240px] resize-y font-mono text-xs leading-relaxed`}
            />
          </label>
          <label className="block">
            <span className={modalLabelClass}>기본 Category</span>
            <select
              value={defaultCategory}
              onChange={(event) => setDefaultCategory(event.target.value as DetailCategory)}
              className={modalInputClass}
            >
              <option value="New Feature">New Feature</option>
              <option value="Improvement">Improvement</option>
              <option value="Bug Fix">Bug Fix</option>
            </select>
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-park-border bg-park-surface px-4 py-3 text-sm text-slate-700">
            <p className="font-bold text-park-navy">분석 요약</p>
            <p className="mt-1">
              PMS {summary.pmsCount}건 · 그룹 {summary.groupTitleCount} · Description{' '}
              {summary.descriptionLineCount}줄 · 연관 PMS {summary.relatedPmsCount} · 미분류{' '}
              {summary.unclassifiedCount}
            </p>
          </div>

          {allWarnings.length > 0 ? (
            <div className="rounded-xl border border-park-orange/40 bg-orange-50 px-4 py-3 text-sm text-orange-900">
              <p className="font-bold">경고</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {allWarnings.map((warning, index) => (
                  <li key={`${warning.code}-${index}`}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {unclassifiedLines.length > 0 ? (
            <div className="rounded-xl border border-park-border bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-bold text-slate-700">미분류 줄</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {unclassifiedLines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className={modalLabelClass}>그룹명 저장 방식</legend>
            {GROUP_MODE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="group-mode"
                  value={option.value}
                  checked={groupMode === option.value}
                  onChange={() => setGroupMode(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div className="hidden md:block">
            <div className="overflow-x-auto rounded-xl border border-park-border">
              <table className="w-full min-w-[720px] border-collapse text-xs">
                <thead>
                  <tr className="bg-park-navy text-left text-white">
                    <th className="px-2 py-2">Reference</th>
                    <th className="px-2 py-2">Group</th>
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2">Item</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">관계</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={index} className="border-t border-park-border align-top">
                      <td className="px-2 py-2">
                        <input
                          value={row.ref}
                          onChange={(e) => updatePreviewRow(index, 'ref', e.target.value)}
                          className={cellInputClass}
                        />
                      </td>
                      <td className="px-2 py-2">
                        {row.group ? (
                          <span className="inline-block rounded-full bg-park-surface px-2 py-1 text-[10px] font-bold text-park-blue">
                            {row.group}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <select
                          value={row.category}
                          onChange={(e) => updatePreviewRow(index, 'category', e.target.value)}
                          className={cellInputClass}
                        >
                          <option value="New Feature">New Feature</option>
                          <option value="Improvement">Improvement</option>
                          <option value="Bug Fix">Bug Fix</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <input
                          value={row.title}
                          onChange={(e) => updatePreviewRow(index, 'title', e.target.value)}
                          className={cellInputClass}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <textarea
                          value={row.desc}
                          onChange={(e) => updatePreviewRow(index, 'desc', e.target.value)}
                          className={`${cellInputClass} min-h-[70px] resize-y`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        {row.relationType === 'related-pms' ? (
                          <div className="space-y-1">
                            <span className="inline-block rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-park-orange">
                              연관 PMS
                            </span>
                            {row.parentRef ? (
                              <p className="text-[10px] text-slate-500">↳ {row.parentRef}</p>
                            ) : null}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <button type="button" onClick={() => removePreviewRow(index)} className={btnDanger}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            {previewRows.map((row, index) => (
              <div key={index} className="rounded-xl border border-park-border bg-white p-3 shadow-sm">
                <div className="mb-2 flex flex-wrap gap-2">
                  {row.group ? (
                    <span className="rounded-full bg-park-surface px-2 py-1 text-[10px] font-bold text-park-blue">
                      {row.group}
                    </span>
                  ) : null}
                  {row.relationType === 'related-pms' ? (
                    <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-bold text-park-orange">
                      연관 PMS
                    </span>
                  ) : null}
                </div>
                {row.parentRef ? (
                  <p className="mb-2 text-[10px] text-slate-500">부모: {row.parentRef}</p>
                ) : null}
                <div className="space-y-2">
                  <input
                    value={row.ref}
                    onChange={(e) => updatePreviewRow(index, 'ref', e.target.value)}
                    className={cellInputClass}
                    placeholder="Reference"
                  />
                  <select
                    value={row.category}
                    onChange={(e) => updatePreviewRow(index, 'category', e.target.value)}
                    className={cellInputClass}
                  >
                    <option value="New Feature">New Feature</option>
                    <option value="Improvement">Improvement</option>
                    <option value="Bug Fix">Bug Fix</option>
                  </select>
                  <input
                    value={row.title}
                    onChange={(e) => updatePreviewRow(index, 'title', e.target.value)}
                    className={cellInputClass}
                    placeholder="Item"
                  />
                  <textarea
                    value={row.desc}
                    onChange={(e) => updatePreviewRow(index, 'desc', e.target.value)}
                    className={`${cellInputClass} min-h-[80px] resize-y`}
                    placeholder="Description"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePreviewRow(index)}
                  className={`${btnDanger} mt-3 w-full`}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>

          {previewRows.length === 0 ? (
            <p className="text-center text-sm text-slate-500">분석된 항목이 없습니다.</p>
          ) : null}
        </div>
      )}
    </ModalShell>
  );
}
