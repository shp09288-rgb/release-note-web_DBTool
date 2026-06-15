'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { ReleaseNotePreviewData } from '@/components/editor/preview/preview-types';
import { getPrimaryPreviewSection } from '@/components/editor/preview/preview-types';
import type { SectionKey } from '@/components/editor/types';
import { PreviewHeader } from '@/components/editor/preview/preview-header';
import { PreviewHistory } from '@/components/editor/preview/preview-history';
import { PreviewNotes } from '@/components/editor/preview/preview-notes';
import { PreviewOverview } from '@/components/editor/preview/preview-overview';
import {
  PreviewSectionBlock,
  PreviewSectionTitle,
  PreviewSubTitle,
} from '@/components/editor/preview/preview-section-block';
import { PreviewSystemDetail } from '@/components/editor/preview/preview-system-detail';
import { buildDocumentSections } from '@/lib/release-note-document-model';

type ReleaseNotePreviewProps = {
  data: ReleaseNotePreviewData;
  activeSection: SectionKey;
  scrollToActiveSection?: boolean;
};

export function ReleaseNotePreview({
  data,
  activeSection,
  scrollToActiveSection = false,
}: ReleaseNotePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => buildDocumentSections(data), [data]);

  useEffect(() => {
    if (!scrollToActiveSection) return;

    const sectionId = getPrimaryPreviewSection(activeSection);
    if (!sectionId) return;

    const frame = window.requestAnimationFrame(() => {
      const target = containerRef.current?.querySelector(
        `[data-preview-section="${sectionId}"]`
      );
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, scrollToActiveSection]);

  return (
    <div ref={containerRef} className="space-y-4 text-slate-800">
      {sections.map((section) => {
        switch (section.kind) {
          case 'header':
            return (
              <PreviewSectionBlock
                key={section.id}
                sectionId={section.id}
                activeSection={activeSection}
              >
                <PreviewHeader payload={section.payload} />
              </PreviewSectionBlock>
            );

          case 'overview':
            return (
              <PreviewSectionBlock
                key={section.id}
                sectionId={section.id}
                activeSection={activeSection}
              >
                <PreviewSectionTitle>{section.sectionTitle}</PreviewSectionTitle>
                <PreviewOverview items={section.payload.items} />
              </PreviewSectionBlock>
            );

          case 'systemDetail':
            return (
              <PreviewSectionBlock
                key={section.id}
                sectionId={section.id}
                activeSection={activeSection}
                className={section.id === 'xea' ? 'space-y-3' : undefined}
              >
                {section.sectionTitle ? (
                  <PreviewSectionTitle>{section.sectionTitle}</PreviewSectionTitle>
                ) : null}
                {section.subTitle ? (
                  <PreviewSubTitle>{section.subTitle}</PreviewSubTitle>
                ) : null}
                {section.hasContent ? (
                  <PreviewSystemDetail
                    label={section.payload.label}
                    items={section.payload.items}
                    before={section.payload.before}
                    after={section.payload.after}
                  />
                ) : null}
              </PreviewSectionBlock>
            );

          case 'notes':
            return (
              <PreviewSectionBlock
                key={section.id}
                sectionId={section.id}
                activeSection={activeSection}
              >
                <PreviewSectionTitle>{section.sectionTitle}</PreviewSectionTitle>
                <PreviewNotes items={section.payload.items} />
              </PreviewSectionBlock>
            );

          case 'history':
            return (
              <PreviewSectionBlock
                key={section.id}
                sectionId={section.id}
                activeSection={activeSection}
              >
                <PreviewSectionTitle>{section.sectionTitle}</PreviewSectionTitle>
                <PreviewHistory history={section.payload.items} />
                {section.footnote ? (
                  <p className="mt-2 text-[10px] text-slate-500 sm:text-xs">
                    {section.footnote}
                  </p>
                ) : null}
              </PreviewSectionBlock>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
