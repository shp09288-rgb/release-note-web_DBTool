export type SectionKey =
  | 'basic'
  | 'xea'
  | 'xes'
  | 'test'
  | 'notes'
  | 'history'
  | 'generate';

export type DetailCategory = 'New Feature' | 'Improvement' | 'Bug Fix';

export interface DetailRow {
  ref: string;
  category: DetailCategory;
  title: string;
  desc: string;
}

export interface NoteRow {
  icon: '!' | 'i';
  text: string;
}

export interface HistoryRow {
  date: string;
  xea: string;
  xes: string;
  cim: string;
  summary: string;
}

export const EDITOR_NAV_ITEMS: { key: SectionKey; label: string; num: string }[] = [
  { key: 'basic', label: '기본 정보', num: '1' },
  { key: 'xea', label: 'XEA 상세', num: '2' },
  { key: 'xes', label: 'XES 상세', num: '3' },
  { key: 'test', label: 'Test Version', num: '4' },
  { key: 'notes', label: 'Important Notes', num: '5' },
  { key: 'history', label: '업데이트 이력', num: '6' },
  { key: 'generate', label: '생성 & 다운로드', num: '✓' },
];

export const USER_NAME_STORAGE_KEY = 'rn_user_name';

export function normalizeUserName(value: string | null | undefined) {
  const trimmed = String(value || '').trim();
  return trimmed || 'User01';
}
