'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearReleaseNoteDraft,
  DRAFT_SAVE_DEBOUNCE_MS,
  hasDraftContent,
  loadReleaseNoteDraft,
  type ReleaseNoteDraft,
  saveReleaseNoteDraft,
} from '@/lib/release-note-draft';

export type DraftEditorState = Omit<ReleaseNoteDraft, 'version' | 'savedAt'>;

type UseReleaseNoteDraftOptions = {
  site: string;
  equipment: string;
  readOnly: boolean;
  serverLoadComplete: boolean;
  state: DraftEditorState;
  applyDraft: (draft: ReleaseNoteDraft) => void;
};

export function useReleaseNoteDraft({
  site,
  equipment,
  readOnly,
  serverLoadComplete,
  state,
  applyDraft,
}: UseReleaseNoteDraftOptions) {
  const [draftResolved, setDraftResolved] = useState(false);

  const initialDraft = useMemo(() => {
    if (!serverLoadComplete) return undefined;

    const draft = loadReleaseNoteDraft(site, equipment);
    if (draft && hasDraftContent(draft)) return draft;
    return null;
  }, [serverLoadComplete, site, equipment]);

  const draftModalOpen = initialDraft != null && !draftResolved;
  const autoSaveEnabled =
    serverLoadComplete && initialDraft !== undefined && (initialDraft === null || draftResolved);

  useEffect(() => {
    if (!autoSaveEnabled || readOnly || draftModalOpen) return;

    const timer = window.setTimeout(() => {
      if (!hasDraftContent({ ...state, version: 1, savedAt: new Date().toISOString() })) {
        return;
      }

      saveReleaseNoteDraft(site, equipment, state);
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [autoSaveEnabled, readOnly, draftModalOpen, site, equipment, state]);

  const handleRestoreDraft = useCallback(() => {
    if (!initialDraft) return;

    applyDraft(initialDraft);
    setDraftResolved(true);
  }, [applyDraft, initialDraft]);

  const handleDiscardDraft = useCallback(() => {
    clearReleaseNoteDraft(site, equipment);
    setDraftResolved(true);
  }, [site, equipment]);

  const clearDraft = useCallback(() => {
    clearReleaseNoteDraft(site, equipment);
  }, [site, equipment]);

  return {
    draftModalOpen,
    pendingDraftSavedAt: initialDraft?.savedAt ?? '',
    handleRestoreDraft,
    handleDiscardDraft,
    clearDraft,
  };
}

export type { ReleaseNoteDraft };
