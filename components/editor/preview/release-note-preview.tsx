'use client';

import { useEffect, useRef } from 'react';
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
      <PreviewSectionBlock sectionId="header" activeSection={activeSection}>
        <PreviewHeader
          site={data.site}
          date={data.date}
          xeaBefore={data.xeaBefore}
          xeaAfter={data.xeaAfter}
          xesBefore={data.xesBefore}
          xesAfter={data.xesAfter}
          cimVer={data.cimVer}
        />
      </PreviewSectionBlock>

      <PreviewSectionBlock sectionId="overview" activeSection={activeSection}>
        <PreviewSectionTitle>1. Release Overview</PreviewSectionTitle>
        <PreviewOverview overview={data.overview} />
      </PreviewSectionBlock>

      <PreviewSectionBlock sectionId="xea" activeSection={activeSection} className="space-y-3">
        <PreviewSectionTitle>2. System Detail</PreviewSectionTitle>
        {data.xeaDetails.length > 0 ? (
          <PreviewSubTitle>2.1 XEA</PreviewSubTitle>
        ) : null}
        <PreviewSystemDetail
          label="XEA"
          items={data.xeaDetails}
          before={data.xeaBefore}
          after={data.xeaAfter}
        />
      </PreviewSectionBlock>

      <PreviewSectionBlock sectionId="xes" activeSection={activeSection}>
        {data.xesDetails.length > 0 ? <PreviewSubTitle>2.2 XES</PreviewSubTitle> : null}
        <PreviewSystemDetail
          label="XES"
          items={data.xesDetails}
          before={data.xesBefore}
          after={data.xesAfter}
        />
      </PreviewSectionBlock>

      <PreviewSectionBlock sectionId="test" activeSection={activeSection}>
        {data.testVersions.length > 0 ? (
          <PreviewSubTitle>2.3 Test Version</PreviewSubTitle>
        ) : null}
        <PreviewSystemDetail
          label="Test Version"
          items={data.testVersions}
          before="Export"
          after="Verified"
        />
      </PreviewSectionBlock>

      <PreviewSectionBlock sectionId="notes" activeSection={activeSection}>
        <PreviewSectionTitle>4. Important Notes</PreviewSectionTitle>
        <PreviewNotes notes={data.notes} />
      </PreviewSectionBlock>

      <PreviewSectionBlock sectionId="history" activeSection={activeSection}>
        <PreviewSectionTitle>5. SW Update History</PreviewSectionTitle>
        <PreviewHistory history={data.history} />
        <p className="mt-2 text-[10px] text-slate-500 sm:text-xs">
          ※ 최신 버전이 상단에 표시됩니다.
        </p>
      </PreviewSectionBlock>
    </div>
  );
}
