'use client';

import type { CSSProperties, ReactNode } from 'react';
import { PreviewPanel, PreviewResizeHandle } from '@/components/editor/preview/preview-panel';
import { PreviewViewModeTabs } from '@/components/editor/preview/preview-view-mode-tabs';
import type {
  EditorViewMode,
  ReleaseNotePreviewData,
} from '@/components/editor/preview/preview-types';
import type { SectionKey } from '@/components/editor/types';

type PreviewLayoutProps = {
  activeSection: SectionKey;
  previewData: ReleaseNotePreviewData;
  previewWidthPct: number;
  editorWidthPct: number;
  onResize: (deltaPx: number, containerWidth: number) => void;
  mobileViewMode: EditorViewMode;
  onMobileViewModeChange: (mode: EditorViewMode) => void;
  previewCollapsed: boolean;
  onTogglePreviewCollapse: () => void;
  children: ReactNode;
};

export function PreviewLayout({
  activeSection,
  previewData,
  previewWidthPct,
  editorWidthPct,
  onResize,
  mobileViewMode,
  onMobileViewModeChange,
  previewCollapsed,
  onTogglePreviewCollapse,
  children,
}: PreviewLayoutProps) {
  const splitStyle = {
    '--editor-width-pct': `${editorWidthPct}%`,
    '--preview-width-pct': `${previewWidthPct}%`,
  } as CSSProperties;

  const showEditor = mobileViewMode === 'edit';
  const showMobilePreview = mobileViewMode === 'preview';

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PreviewViewModeTabs mode={mobileViewMode} onModeChange={onMobileViewModeChange} />

      <div
        className={[
          'flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row',
          showMobilePreview ? 'overflow-hidden' : '',
        ].join(' ')}
        style={splitStyle}
      >
        <main
          className={[
            'editor-main-panel min-w-0 w-full p-4 sm:p-6',
            showEditor ? 'block' : 'hidden',
            'lg:block',
            'pb-28 lg:pb-6 xl:pb-6',
          ].join(' ')}
        >
          {children}
        </main>

        <PreviewResizeHandle onResize={onResize} />

        <PreviewPanel
          layout="desktop"
          data={previewData}
          activeSection={activeSection}
          scrollToActiveSection={false}
        />

        <PreviewPanel
          layout="tablet"
          data={previewData}
          activeSection={activeSection}
          collapsed={previewCollapsed}
          onToggleCollapse={onTogglePreviewCollapse}
          scrollToActiveSection
        />

        {showMobilePreview ? (
          <PreviewPanel
            layout="mobile"
            data={previewData}
            activeSection={activeSection}
            scrollToActiveSection
            onBackToEdit={() => onMobileViewModeChange('edit')}
          />
        ) : null}
      </div>
    </div>
  );
}
