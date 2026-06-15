import type { DetailRow, HistoryRow, NoteRow } from '@/components/editor/types';

export type DocumentSectionId =
  | 'header'
  | 'overview'
  | 'xea'
  | 'xes'
  | 'test'
  | 'notes'
  | 'history';

export interface ReleaseNoteDocumentInput {
  site: string;
  equipment?: string;
  date: string;
  xeaBefore: string;
  xeaAfter: string;
  xesBefore: string;
  xesAfter: string;
  cimVer: string;
  overview: string[];
  xeaDetails: DetailRow[];
  xesDetails: DetailRow[];
  testVersions: DetailRow[];
  notes: NoteRow[];
  history: HistoryRow[];
}

export interface ReleaseNoteDocument {
  site: string;
  equipment: string;
  date: string;
  xeaBefore: string;
  xeaAfter: string;
  xesBefore: string;
  xesAfter: string;
  cimVer: string;
  overview: string[];
  xeaDetails: DetailRow[];
  xesDetails: DetailRow[];
  testVersions: DetailRow[];
  notes: NoteRow[];
  history: HistoryRow[];
}

export interface HeaderSectionPayload {
  site: string;
  date: string;
  xeaBefore: string;
  xeaAfter: string;
  xesBefore: string;
  xesAfter: string;
  targetSystem: string;
}

export interface OverviewSectionPayload {
  items: string[];
}

export interface SystemDetailSectionPayload {
  label: string;
  before: string;
  after: string;
  items: DetailRow[];
}

export interface NotesSectionPayload {
  items: NoteRow[];
}

export interface HistorySectionPayload {
  items: HistoryRow[];
}

export type DocumentSection =
  | {
      id: 'header';
      kind: 'header';
      visible: true;
      payload: HeaderSectionPayload;
    }
  | {
      id: 'overview';
      kind: 'overview';
      visible: true;
      sectionTitle: string;
      payload: OverviewSectionPayload;
    }
  | {
      id: 'xea' | 'xes' | 'test';
      kind: 'systemDetail';
      sectionTitle?: string;
      subTitle?: string;
      hasContent: boolean;
      payload: SystemDetailSectionPayload;
    }
  | {
      id: 'notes';
      kind: 'notes';
      visible: true;
      sectionTitle: string;
      payload: NotesSectionPayload;
    }
  | {
      id: 'history';
      kind: 'history';
      visible: true;
      sectionTitle: string;
      payload: HistorySectionPayload;
      footnote?: string;
    };

export const DOCUMENT_SECTION_TITLES = {
  overview: '1. Release Overview',
  systemDetail: '2. System Detail',
  notes: '4. Important Notes',
  history: '5. SW Update History',
} as const;

export const DOCUMENT_FOOTNOTES = {
  historyLatestOnTop: '※ 최신 버전이 상단에 표시됩니다.',
} as const;

export const TEST_VERSION_RANGE = {
  before: 'Export',
  after: 'Verified',
} as const;

/** Mirrors display rules documented alongside app/api/generate-docx/route.ts */
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

export function getTargetSystemLabel(cimVer: string): string {
  const cim = String(cimVer ?? '').trim();
  return cim ? 'XEA / XES / CIM' : 'XEA / XES';
}

export type CategoryColorKey = 'New Feature' | 'Improvement' | 'Bug Fix' | 'Test Version' | string;

export function getCategoryColorHex(category: CategoryColorKey): string {
  switch (category) {
    case 'New Feature':
      return '4472C4';
    case 'Test Version':
      return '7030A0';
    case 'Improvement':
      return '00703C';
    case 'Bug Fix':
      return 'C00000';
    default:
      return 'C00000';
  }
}

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

export function getNoteIconColorHex(icon: '!' | 'i'): string {
  return icon === '!' ? 'C00000' : '1B3A6B';
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

export function normalizeReleaseNoteDocument(input: ReleaseNoteDocumentInput): ReleaseNoteDocument {
  return {
    site: String(input.site ?? '').replace(/_/g, ' '),
    equipment: String(input.equipment ?? ''),
    date: String(input.date ?? ''),
    xeaBefore: String(input.xeaBefore ?? ''),
    xeaAfter: String(input.xeaAfter ?? ''),
    xesBefore: String(input.xesBefore ?? ''),
    xesAfter: String(input.xesAfter ?? ''),
    cimVer: String(input.cimVer ?? ''),
    overview: Array.isArray(input.overview) ? input.overview.map(String) : [],
    xeaDetails: Array.isArray(input.xeaDetails) ? input.xeaDetails : [],
    xesDetails: Array.isArray(input.xesDetails) ? input.xesDetails : [],
    testVersions: Array.isArray(input.testVersions) ? input.testVersions : [],
    notes: Array.isArray(input.notes) ? input.notes : [],
    history: Array.isArray(input.history) ? input.history : [],
  };
}

function buildOverviewItems(overview: string[]): string[] {
  return overview.length > 0 ? overview : [''];
}

function buildNotesItems(notes: NoteRow[]): NoteRow[] {
  return notes.length > 0 ? notes : [{ icon: '!', text: '' }];
}

export function buildDocumentSections(document: ReleaseNoteDocument): DocumentSection[] {
  const sections: DocumentSection[] = [
    {
      id: 'header',
      kind: 'header',
      visible: true,
      payload: {
        site: document.site,
        date: document.date,
        xeaBefore: document.xeaBefore,
        xeaAfter: document.xeaAfter,
        xesBefore: document.xesBefore,
        xesAfter: document.xesAfter,
        targetSystem: getTargetSystemLabel(document.cimVer),
      },
    },
    {
      id: 'overview',
      kind: 'overview',
      visible: true,
      sectionTitle: DOCUMENT_SECTION_TITLES.overview,
      payload: {
        items: buildOverviewItems(document.overview),
      },
    },
  ];

  const systemDetailDefs: Array<{
    id: 'xea' | 'xes' | 'test';
    subTitle: string;
    label: string;
    before: string;
    after: string;
    items: DetailRow[];
  }> = [
    {
      id: 'xea',
      subTitle: '2.1 XEA',
      label: 'XEA',
      before: document.xeaBefore,
      after: document.xeaAfter,
      items: document.xeaDetails,
    },
    {
      id: 'xes',
      subTitle: '2.2 XES',
      label: 'XES',
      before: document.xesBefore,
      after: document.xesAfter,
      items: document.xesDetails,
    },
    {
      id: 'test',
      subTitle: '2.3 Test Version',
      label: 'Test Version',
      before: TEST_VERSION_RANGE.before,
      after: TEST_VERSION_RANGE.after,
      items: document.testVersions,
    },
  ];

  for (const detail of systemDetailDefs) {
    const hasContent = detail.items.length > 0;

    sections.push({
      id: detail.id,
      kind: 'systemDetail',
      sectionTitle:
        detail.id === 'xea' ? DOCUMENT_SECTION_TITLES.systemDetail : undefined,
      subTitle: hasContent ? detail.subTitle : undefined,
      hasContent,
      payload: {
        label: detail.label,
        before: detail.before,
        after: detail.after,
        items: detail.items,
      },
    });
  }

  sections.push(
    {
      id: 'notes',
      kind: 'notes',
      visible: true,
      sectionTitle: DOCUMENT_SECTION_TITLES.notes,
      payload: {
        items: buildNotesItems(document.notes),
      },
    },
    {
      id: 'history',
      kind: 'history',
      visible: true,
      sectionTitle: DOCUMENT_SECTION_TITLES.history,
      payload: {
        items: document.history,
      },
      footnote: DOCUMENT_FOOTNOTES.historyLatestOnTop,
    }
  );

  return sections;
}

/** @deprecated Use getTargetSystemLabel */
export const targetSystemLabel = getTargetSystemLabel;
