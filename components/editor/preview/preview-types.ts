import type { SectionKey } from '@/components/editor/types';
import type {
  DocumentSectionId,
  ReleaseNoteDocument,
} from '@/lib/release-note-document-model';

export type ReleaseNotePreviewData = ReleaseNoteDocument;

export type PreviewSectionId = DocumentSectionId;

export function getHighlightedSections(activeSection: SectionKey): PreviewSectionId[] {
  switch (activeSection) {
    case 'basic':
      return ['header', 'overview'];
    case 'xea':
      return ['xea'];
    case 'xes':
      return ['xes'];
    case 'cim':
      return ['cim'];
    case 'test':
      return ['test'];
    case 'notes':
      return ['notes'];
    case 'history':
      return ['history'];
    case 'generate':
      return ['header', 'overview', 'xea', 'xes', 'cim', 'test', 'notes', 'history'];
    default:
      return [];
  }
}

export function isSectionHighlighted(
  sectionId: PreviewSectionId,
  activeSection: SectionKey
): boolean {
  return getHighlightedSections(activeSection).includes(sectionId);
}

export const PREVIEW_WIDTH_STORAGE_KEY = 'rn_preview_width_pct';
export const PREVIEW_WIDTH_DEFAULT_PCT = 50;
export const PREVIEW_WIDTH_MIN_PCT = 25;
export const PREVIEW_WIDTH_MAX_PCT = 65;

export const PREVIEW_COLLAPSED_STORAGE_KEY = 'rn_preview_collapsed';

export type EditorViewMode = 'edit' | 'preview';

export function getPrimaryPreviewSection(activeSection: SectionKey): PreviewSectionId | null {
  const sections = getHighlightedSections(activeSection);
  return sections[0] ?? null;
}
