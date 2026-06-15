import type { PreviewSectionId } from '@/components/editor/preview/preview-types';
import type { SectionKey } from '@/components/editor/types';
import { isSectionHighlighted } from '@/components/editor/preview/preview-types';

type PreviewSectionBlockProps = {
  sectionId: PreviewSectionId;
  activeSection: SectionKey;
  children: React.ReactNode;
  className?: string;
};

export function PreviewSectionBlock({
  sectionId,
  activeSection,
  children,
  className = '',
}: PreviewSectionBlockProps) {
  const highlighted = isSectionHighlighted(sectionId, activeSection);

  return (
    <div
      data-preview-section={sectionId}
      className={`rounded-lg transition-shadow duration-300 ${
        highlighted ? 'ring-2 ring-park-blue/50 ring-offset-2' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function PreviewSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 border-b-2 border-park-navy pb-1.5 text-xs font-bold text-park-navy sm:text-sm">
      {children}
    </h3>
  );
}

export function PreviewSubTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[10px] font-bold text-park-navy sm:text-xs">{children}</p>
  );
}

export const previewTableClass = 'w-full border-collapse border border-[#AAAAAA] text-[10px] sm:text-xs';

export const previewThClass =
  'border border-[#AAAAAA] bg-[#2E5FA3] px-2 py-1.5 text-center text-[10px] font-bold text-white sm:text-xs';

export const previewThNavyClass =
  'border border-[#AAAAAA] bg-park-navy px-2 py-1.5 text-center text-[10px] font-bold text-white sm:text-xs';

export function previewTdClass(bg: 'white' | 'alt' | 'head' = 'white'): string {
  const bgClass =
    bg === 'head' ? 'bg-[#D9E1F2]' : bg === 'alt' ? 'bg-[#F2F4FB]' : 'bg-white';
  return `border border-[#AAAAAA] ${bgClass} px-2 py-1.5 align-top text-[10px] sm:text-xs`;
}
