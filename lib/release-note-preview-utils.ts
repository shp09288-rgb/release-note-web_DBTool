/** Mirrors display rules from app/api/generate-docx/route.ts */

export function splitLines(value: unknown): string[] {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatEmpty(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '-';
}

export function targetSystemLabel(cimVer: string): string {
  const cim = String(cimVer ?? '').trim();
  return cim ? 'XEA / XES / CIM' : 'XEA / XES';
}

export type CategoryColorKey = 'New Feature' | 'Improvement' | 'Bug Fix' | 'Test Version' | string;

export function getCategoryColorClass(category: CategoryColorKey): string {
  switch (category) {
    case 'New Feature':
      return 'text-[#4472C4]';
    case 'Test Version':
      return 'text-[#7030A0]';
    case 'Improvement':
      return 'text-[#00703C]';
    case 'Bug Fix':
      return 'text-[#C00000]';
    default:
      return 'text-[#C00000]';
  }
}

export function getNoteIconClass(icon: '!' | 'i'): string {
  return icon === '!' ? 'text-[#C00000]' : 'text-park-navy';
}

export function buildHistoryVersionLines(row: {
  xea: string;
  xes: string;
  cim: string;
}): string[] {
  const lines: string[] = [];
  const xea = String(row.xea ?? '').trim();
  const xes = String(row.xes ?? '').trim();
  const cim = String(row.cim ?? '').trim();

  if (xea && xea !== '-') lines.push(`XEA ${xea}`);
  if (xes && xes !== '-') lines.push(`XES ${xes}`);
  if (cim && cim !== '-') lines.push(`CIM ${cim}`);

  return lines;
}
