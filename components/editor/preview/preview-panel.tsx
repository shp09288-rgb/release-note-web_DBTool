'use client';

import { useCallback, useRef, useState } from 'react';
import { ReleaseNotePreview } from '@/components/editor/preview/release-note-preview';
import type { ReleaseNotePreviewData } from '@/components/editor/preview/preview-types';
import {
  PREVIEW_COLLAPSED_STORAGE_KEY,
  PREVIEW_WIDTH_DEFAULT_PCT,
  PREVIEW_WIDTH_MAX_PCT,
  PREVIEW_WIDTH_MIN_PCT,
  PREVIEW_WIDTH_STORAGE_KEY,
} from '@/components/editor/preview/preview-types';
import type { SectionKey } from '@/components/editor/types';
import { btnOutline, btnPrimary } from '@/components/forms/form-classes';

type PreviewPanelLayout = 'desktop' | 'tablet' | 'mobile';

type PreviewPanelProps = {
  layout: PreviewPanelLayout;
  data: ReleaseNotePreviewData;
  activeSection: SectionKey;
  scrollToActiveSection?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onBackToEdit?: () => void;
};

function PreviewPanelHeader({
  data,
  collapsed,
  onToggleCollapse,
  showCollapseControl,
}: {
  data: ReleaseNotePreviewData;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showCollapseControl?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-park-border bg-park-surface px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden />
          <h2 className="text-sm font-bold text-park-navy">실시간 Preview</h2>
        </div>
        <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">
          {data.site} · {data.equipment}
        </p>
      </div>
      {showCollapseControl && onToggleCollapse ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className={btnOutline}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Preview 펼치기' : 'Preview 접기'}
        </button>
      ) : null}
    </div>
  );
}

function PreviewPanelBody({
  data,
  activeSection,
  scrollToActiveSection,
  className = '',
}: {
  data: ReleaseNotePreviewData;
  activeSection: SectionKey;
  scrollToActiveSection?: boolean;
  className?: string;
}) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto p-4 ${className}`}>
      <div className="rounded-lg border border-park-border bg-white p-4 shadow-sm">
        <ReleaseNotePreview
          data={data}
          activeSection={activeSection}
          scrollToActiveSection={scrollToActiveSection}
        />
      </div>
      <p className="mt-3 text-center text-[10px] text-slate-400 sm:text-xs">
        ※ Preview는 DOCX 레이아웃 근사치입니다.
      </p>
    </div>
  );
}

export function PreviewPanel({
  layout,
  data,
  activeSection,
  scrollToActiveSection = false,
  collapsed = false,
  onToggleCollapse,
  onBackToEdit,
}: PreviewPanelProps) {
  if (layout === 'desktop') {
    return (
      <aside
        className="preview-desktop-panel hidden min-h-0 shrink-0 flex-col border-l border-park-border bg-white xl:flex"
        aria-label="Release Note Preview"
      >
        <PreviewPanelHeader data={data} />
        <PreviewPanelBody
          data={data}
          activeSection={activeSection}
          scrollToActiveSection={scrollToActiveSection}
        />
      </aside>
    );
  }

  if (layout === 'tablet') {
    if (collapsed) {
      return (
        <aside
          className="hidden shrink-0 border-t border-park-border bg-white lg:flex xl:hidden"
          aria-label="Release Note Preview collapsed"
        >
          <div className="flex w-full items-center justify-between px-4 py-3">
            <span className="text-sm font-bold text-park-navy">Preview (접힘)</span>
            <button type="button" onClick={onToggleCollapse} className={btnOutline}>
              Preview 펼치기
            </button>
          </div>
        </aside>
      );
    }

    return (
      <aside
        className="hidden max-h-[45vh] min-h-0 shrink-0 flex-col border-t border-park-border bg-white lg:flex xl:hidden"
        aria-label="Release Note Preview"
      >
        <PreviewPanelHeader
          data={data}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          showCollapseControl
        />
        <PreviewPanelBody
          data={data}
          activeSection={activeSection}
          scrollToActiveSection={scrollToActiveSection}
        />
      </aside>
    );
  }

  return (
    <aside
      className="flex min-h-0 flex-1 flex-col bg-white lg:hidden"
      aria-label="Release Note Preview mobile"
    >
      <PreviewPanelHeader data={data} />
      <PreviewPanelBody
        data={data}
        activeSection={activeSection}
        scrollToActiveSection={scrollToActiveSection}
        className="pb-24"
      />
      {onBackToEdit ? (
        <div className="sticky bottom-0 z-10 border-t border-park-border bg-white/95 px-4 py-4 backdrop-blur">
          <button type="button" onClick={onBackToEdit} className={`${btnPrimary} w-full`}>
            편집으로 돌아가기
          </button>
        </div>
      ) : null}
    </aside>
  );
}

type PreviewResizeHandleProps = {
  onResize: (deltaPx: number, containerWidth: number) => void;
};

export function PreviewResizeHandle({ onResize }: PreviewResizeHandleProps) {
  const dragging = useRef(false);
  const containerWidth = useRef(0);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    const container = event.currentTarget.parentElement;
    containerWidth.current = container?.clientWidth ?? 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      onResize(-event.movementX, containerWidth.current);
    },
    [onResize]
  );

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Preview panel width"
      className="hidden w-1.5 shrink-0 cursor-col-resize bg-park-border transition-colors hover:bg-park-blue/40 active:bg-park-blue/60 xl:block"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    />
  );
}

export function usePreviewPanelWidth() {
  const [previewWidthPct, setPreviewWidthPct] = useState(() => {
    if (typeof window === 'undefined') return PREVIEW_WIDTH_DEFAULT_PCT;

    const stored = window.localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY);
    if (!stored) return PREVIEW_WIDTH_DEFAULT_PCT;

    const parsed = Number.parseFloat(stored);
    if (
      Number.isFinite(parsed) &&
      parsed >= PREVIEW_WIDTH_MIN_PCT &&
      parsed <= PREVIEW_WIDTH_MAX_PCT
    ) {
      return parsed;
    }

    return PREVIEW_WIDTH_DEFAULT_PCT;
  });

  const persistWidth = useCallback((pct: number) => {
    window.localStorage.setItem(PREVIEW_WIDTH_STORAGE_KEY, String(pct));
  }, []);

  const handleResize = useCallback(
    (deltaPx: number, containerWidth: number) => {
      if (containerWidth <= 0) return;

      setPreviewWidthPct((prev) => {
        const deltaPct = (deltaPx / containerWidth) * 100;
        const next = Math.min(
          PREVIEW_WIDTH_MAX_PCT,
          Math.max(PREVIEW_WIDTH_MIN_PCT, prev + deltaPct)
        );
        persistWidth(next);
        return next;
      });
    },
    [persistWidth]
  );

  return { previewWidthPct, handleResize };
}

export function usePreviewCollapsed() {
  const [collapsed, setCollapsedState] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(PREVIEW_COLLAPSED_STORAGE_KEY) === 'true';
  });

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    window.localStorage.setItem(PREVIEW_COLLAPSED_STORAGE_KEY, String(value));
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      window.localStorage.setItem(PREVIEW_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const expandPreview = useCallback(() => {
    setCollapsed(false);
  }, [setCollapsed]);

  return { collapsed, setCollapsed, toggleCollapsed, expandPreview };
}
