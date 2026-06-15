import type {
  DetailRow,
  HistoryRow,
  NoteRow,
  SectionKey,
} from '@/components/editor/types';

export const DRAFT_SAVE_DEBOUNCE_MS = 10_000;

export interface ReleaseNoteDraft {
  version: 1;
  savedAt: string;
  activeSection: SectionKey;
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

export function getDraftStorageKey(site: string, equipment: string) {
  return `release_note_draft_${site}_${equipment}`;
}

export function loadReleaseNoteDraft(
  site: string,
  equipment: string
): ReleaseNoteDraft | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getDraftStorageKey(site, equipment));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ReleaseNoteDraft>;
    if (parsed.version !== 1 || typeof parsed.savedAt !== 'string') return null;

    return {
      version: 1,
      savedAt: parsed.savedAt,
      activeSection: (parsed.activeSection as SectionKey) || 'basic',
      date: String(parsed.date ?? ''),
      xeaBefore: String(parsed.xeaBefore ?? ''),
      xeaAfter: String(parsed.xeaAfter ?? ''),
      xesBefore: String(parsed.xesBefore ?? ''),
      xesAfter: String(parsed.xesAfter ?? ''),
      cimVer: String(parsed.cimVer ?? ''),
      overview: Array.isArray(parsed.overview) ? parsed.overview.map(String) : [''],
      xeaDetails: Array.isArray(parsed.xeaDetails) ? parsed.xeaDetails : [],
      xesDetails: Array.isArray(parsed.xesDetails) ? parsed.xesDetails : [],
      testVersions: Array.isArray(parsed.testVersions) ? parsed.testVersions : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return null;
  }
}

export function saveReleaseNoteDraft(
  site: string,
  equipment: string,
  draft: Omit<ReleaseNoteDraft, 'version' | 'savedAt'> & { savedAt?: string }
) {
  if (typeof window === 'undefined') return;

  const payload: ReleaseNoteDraft = {
    version: 1,
    savedAt: draft.savedAt ?? new Date().toISOString(),
    activeSection: draft.activeSection,
    date: draft.date,
    xeaBefore: draft.xeaBefore,
    xeaAfter: draft.xeaAfter,
    xesBefore: draft.xesBefore,
    xesAfter: draft.xesAfter,
    cimVer: draft.cimVer,
    overview: draft.overview,
    xeaDetails: draft.xeaDetails,
    xesDetails: draft.xesDetails,
    testVersions: draft.testVersions,
    notes: draft.notes,
    history: draft.history,
  };

  window.localStorage.setItem(getDraftStorageKey(site, equipment), JSON.stringify(payload));
}

export function clearReleaseNoteDraft(site: string, equipment: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getDraftStorageKey(site, equipment));
}

export function formatDraftSavedAt(savedAt: string) {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return savedAt;

  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function hasDraftContent(draft: ReleaseNoteDraft) {
  const hasOverviewText = draft.overview.some((item) => String(item || '').trim() !== '');
  const hasXea = String(draft.xeaAfter || draft.xeaBefore || '').trim() !== '';
  const hasXes = String(draft.xesAfter || draft.xesBefore || '').trim() !== '';
  const hasCim = String(draft.cimVer || '').trim() !== '';
  const hasDate = String(draft.date || '').trim() !== '';
  const hasDetails =
    draft.xeaDetails.length > 0 ||
    draft.xesDetails.length > 0 ||
    draft.testVersions.length > 0;
  const hasNotes = draft.notes.length > 0;
  const hasHistory = draft.history.length > 0;

  return (
    hasOverviewText || hasXea || hasXes || hasCim || hasDate || hasDetails || hasNotes || hasHistory
  );
}
