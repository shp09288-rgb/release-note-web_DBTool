import type { DetailCategory, DetailRow } from '@/components/editor/types';

export type BulkParseWarningCode =
  | 'duplicate-ref'
  | 'missing-title'
  | 'ambiguous-line'
  | 'related-pms-candidate'
  | 'orphan-description'
  | 'empty-pms-header';

export type BulkParseWarning = {
  code: BulkParseWarningCode;
  message: string;
  lineNumber?: number;
  ref?: string;
};

export type ParsedBulkRow = DetailRow & {
  group?: string;
  relationType?: 'normal' | 'related-pms';
  parentRef?: string;
  rowWarnings?: string[];
};

export type BulkParseSummary = {
  pmsCount: number;
  groupTitleCount: number;
  descriptionLineCount: number;
  relatedPmsCount: number;
  unclassifiedCount: number;
};

export type BulkParseResult = {
  rows: ParsedBulkRow[];
  warnings: BulkParseWarning[];
  unclassifiedLines: string[];
  summary: BulkParseSummary;
};

export type ParseBulkDetailInputOptions = {
  text: string;
  defaultCategory: DetailCategory;
};

const GROUP_SUFFIXES = [
  '시퀀스 변경 관련',
  '개선 관련',
  '변경 관련',
  '구분 관련',
  '관련',
] as const;

const RELATION_MARKER_RE = /^연관\s*PMS$/i;

export function isExplicitGroupTitle(line: string): boolean {
  const trimmed = line.trim();
  return GROUP_SUFFIXES.some((suffix) => trimmed.endsWith(suffix));
}

export function stripLinePrefix(line: string): string {
  return line
    .replace(/^[\u0009\u00a0\s]+/, '')
    .replace(/^[-•·▪◦*]+\s*/, '')
    .trim();
}

export function formatPmsRef(numbers: number[]): string {
  if (numbers.length === 0) return '';
  return `PMS #${numbers[0]}${numbers.slice(1).map((n) => `, #${n}`).join('')}`;
}

export function parsePmsHeader(line: string): { ref: string; title: string } | null {
  const text = stripLinePrefix(line);
  if (!/^PMS\s*#?\s*\d/i.test(text)) return null;

  let rest = text.replace(/^PMS\s*#?\s*/i, '').trimStart();
  const numbers: number[] = [];

  while (rest.length > 0) {
    const numMatch = rest.match(/^(?:PMS\s*#?\s*)?(\d+)(.*)$/i);
    if (!numMatch) break;

    numbers.push(Number(numMatch[1]));
    let tail = numMatch[2];

    const sepMatch = tail.match(/^\s*([,/])\s*(.*)$/s);
    if (sepMatch) {
      const afterSep = sepMatch[2].trimStart();
      if (/^(?:PMS\s*#?\s*)?\d/i.test(afterSep) || /^#\s*\d/.test(afterSep)) {
        rest = afterSep.replace(/^#\s*/, '');
        continue;
      }
      tail = afterSep;
    }

    const title = tail.trim();
    if (!title) {
      return { ref: formatPmsRef(numbers), title: '' };
    }
    return { ref: formatPmsRef(numbers), title };
  }

  if (numbers.length > 0) {
    return { ref: formatPmsRef(numbers), title: '' };
  }

  return null;
}

function normalizeInputLines(text: string): { line: string; lineNumber: number }[] {
  const normalized = text.replace(/\r\n/g, '\n');
  const result: { line: string; lineNumber: number }[] = [];

  normalized.split('\n').forEach((raw, index) => {
    const line = stripLinePrefix(raw);
    if (line) {
      result.push({ line, lineNumber: index + 1 });
    }
  });

  return result;
}

function flushCurrentRow(
  currentRow: ParsedBulkRow | null,
  rows: ParsedBulkRow[]
): ParsedBulkRow | null {
  if (currentRow) {
    rows.push(currentRow);
  }
  return null;
}

export function parseBulkDetailText(options: ParseBulkDetailInputOptions): BulkParseResult {
  const { text, defaultCategory } = options;
  const lines = normalizeInputLines(text);

  const rows: ParsedBulkRow[] = [];
  const warnings: BulkParseWarning[] = [];
  const unclassifiedLines: string[] = [];

  let currentGroup: string | null = null;
  let currentRow: ParsedBulkRow | null = null;
  let relationMode = false;
  let relationParentRef: string | null = null;
  /** 1차 정책: "연관 PMS" 다음 첫 PMS만 related-pms 처리 */
  let relatedPmsConsumed = false;

  const summary: BulkParseSummary = {
    pmsCount: 0,
    groupTitleCount: 0,
    descriptionLineCount: 0,
    relatedPmsCount: 0,
    unclassifiedCount: 0,
  };

  for (const { line, lineNumber } of lines) {
    const pmsHeader = parsePmsHeader(line);

    if (pmsHeader) {
      currentRow = flushCurrentRow(currentRow, rows);

      const isRelated = relationMode && !relatedPmsConsumed;
      const row: ParsedBulkRow = {
        ref: pmsHeader.ref,
        category: defaultCategory,
        title: pmsHeader.title,
        desc: '',
        group: currentGroup ?? undefined,
        relationType: isRelated ? 'related-pms' : 'normal',
        parentRef: isRelated ? relationParentRef ?? undefined : undefined,
      };

      if (!pmsHeader.title) {
        warnings.push({
          code: 'missing-title',
          message: 'PMS 번호는 있으나 제목이 없습니다.',
          lineNumber,
          ref: pmsHeader.ref,
        });
      }

      if (isRelated) {
        relatedPmsConsumed = true;
        relationMode = false;
        summary.relatedPmsCount += 1;
        row.rowWarnings = ['연관 PMS 후보'];
      }

      currentRow = row;
      summary.pmsCount += 1;
      continue;
    }

    if (RELATION_MARKER_RE.test(line.trim())) {
      if (!currentRow) {
        warnings.push({
          code: 'ambiguous-line',
          message: '"연관 PMS" 앞에 PMS 항목이 없습니다.',
          lineNumber,
        });
      } else {
        relationParentRef = currentRow.ref;
      }
      relationMode = true;
      relatedPmsConsumed = false;
      continue;
    }

    if (isExplicitGroupTitle(line)) {
      currentRow = flushCurrentRow(currentRow, rows);
      currentGroup = line.trim();
      relationMode = false;
      relationParentRef = null;
      relatedPmsConsumed = false;
      summary.groupTitleCount += 1;
      continue;
    }

    if (currentRow) {
      currentRow.desc = currentRow.desc ? `${currentRow.desc}\n${line}` : line;
      summary.descriptionLineCount += 1;
      continue;
    }

    unclassifiedLines.push(line);
    summary.unclassifiedCount += 1;
  }

  flushCurrentRow(currentRow, rows);

  if (!text.trim()) {
    return { rows: [], warnings, unclassifiedLines, summary };
  }

  return { rows, warnings, unclassifiedLines, summary };
}

export function extractPmsNumbers(ref: string): number[] {
  const numbers = [...ref.matchAll(/(\d+)/g)].map((match) => Number(match[1]));
  return [...new Set(numbers)].sort((a, b) => a - b);
}

export function refsHaveSamePmsNumbers(a: string, b: string): boolean {
  const left = extractPmsNumbers(a);
  const right = extractPmsNumbers(b);
  return (
    left.length > 0 &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function findDuplicateRefWarnings(
  existingRows: DetailRow[],
  incomingRows: DetailRow[]
): BulkParseWarning[] {
  const warnings: BulkParseWarning[] = [];

  for (const incoming of incomingRows) {
    if (!incoming.ref.trim()) continue;

    for (const existing of existingRows) {
      if (!existing.ref.trim()) continue;
      if (refsHaveSamePmsNumbers(existing.ref, incoming.ref)) {
        warnings.push({
          code: 'duplicate-ref',
          message: `기존 Reference와 중복됩니다: ${existing.ref}`,
          ref: incoming.ref,
        });
        break;
      }
    }
  }

  for (let i = 0; i < incomingRows.length; i += 1) {
    for (let j = i + 1; j < incomingRows.length; j += 1) {
      const a = incomingRows[i];
      const b = incomingRows[j];
      if (!a.ref.trim() || !b.ref.trim()) continue;
      if (refsHaveSamePmsNumbers(a.ref, b.ref)) {
        warnings.push({
          code: 'duplicate-ref',
          message: `신규 항목 간 Reference 중복: ${a.ref}`,
          ref: a.ref,
        });
      }
    }
  }

  return warnings;
}

export type GroupNameApplyMode = 'desc-prefix' | 'item-prefix' | 'none';

export function applyGroupNameToRows(
  rows: ParsedBulkRow[],
  mode: GroupNameApplyMode
): DetailRow[] {
  return rows.map((row) => {
    const { group, relationType, parentRef, rowWarnings, ...detail } = row;
    void relationType;
    void parentRef;
    void rowWarnings;

    if (!group || mode === 'none') {
      return detail;
    }

    if (mode === 'item-prefix') {
      return {
        ...detail,
        title: `[${group}] ${detail.title}`.trim(),
      };
    }

    const groupLine = `[${group}]`;
    return {
      ...detail,
      desc: detail.desc ? `${groupLine}\n${detail.desc}` : groupLine,
    };
  });
}

export function toDetailRows(rows: ParsedBulkRow[], mode: GroupNameApplyMode = 'desc-prefix'): DetailRow[] {
  return applyGroupNameToRows(rows, mode);
}
