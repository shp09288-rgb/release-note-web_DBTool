import { btnSecondary, sectionCardClass, sectionTitleClass } from '@/components/forms/form-classes';
import { SectionNavFooter } from '@/components/editor/section-nav-footer';

type GenerateSectionProps = {
  readOnly: boolean;
  onSave: () => void;
  onPrev: () => void;
  onDownloadDocx: () => void;
};

export function GenerateSection({
  readOnly,
  onSave,
  onPrev,
  onDownloadDocx,
}: GenerateSectionProps) {
  return (
    <section className={sectionCardClass}>
      <h2 className={sectionTitleClass}>📦 생성 & 다운로드</h2>

      <p className="mb-6 text-sm leading-7 text-slate-600">
        현재 내용 저장을 클릭하고 DOCX 다운로드를 클릭하여 파일을 생성하세요.
      </p>

      <SectionNavFooter
        readOnly={readOnly}
        onPrev={onPrev}
        onSave={onSave}
        extra={
          <button
            type="button"
            onClick={onDownloadDocx}
            disabled={readOnly}
            title={readOnly ? '다른 사용자가 수정 중입니다' : undefined}
            className={`${btnSecondary} ml-auto`}
          >
            DOCX 다운로드
          </button>
        }
      />
    </section>
  );
}
