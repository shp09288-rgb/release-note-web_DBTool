import {
  btnDanger,
  inputClass,
  labelClass,
  readonlyInputClass,
  sectionCardClass,
  sectionTitleClass,
  subTitleClass,
} from '@/components/forms/form-classes';
import { SectionAddButton, SectionNavFooter } from '@/components/editor/section-nav-footer';

const rowIndexClass = 'min-w-[20px] text-sm font-bold text-park-blue';

type BasicInfoSectionProps = {
  readOnly: boolean;
  displaySite: string;
  date: string;
  xeaBefore: string;
  xeaAfter: string;
  xesBefore: string;
  xesAfter: string;
  cimVer: string;
  overview: string[];
  onDateChange: (value: string) => void;
  onXeaBeforeChange: (value: string) => void;
  onXeaAfterChange: (value: string) => void;
  onXesBeforeChange: (value: string) => void;
  onXesAfterChange: (value: string) => void;
  onCimVerChange: (value: string) => void;
  onOverviewChange: (index: number, value: string) => void;
  onAddOverview: () => void;
  onRemoveOverview: (index: number) => void;
  onSave: () => void;
  onNext: () => void;
};

export function BasicInfoSection({
  readOnly,
  displaySite,
  date,
  xeaBefore,
  xeaAfter,
  xesBefore,
  xesAfter,
  cimVer,
  overview,
  onDateChange,
  onXeaBeforeChange,
  onXeaAfterChange,
  onXesBeforeChange,
  onXesAfterChange,
  onCimVerChange,
  onOverviewChange,
  onAddOverview,
  onRemoveOverview,
  onSave,
  onNext,
}: BasicInfoSectionProps) {
  const fieldProps = readOnly ? { readOnly: true as const } : {};

  return (
    <>
      <div className="mb-5 rounded-2xl bg-gradient-to-br from-park-navy to-[#2E5FA3] p-5 text-white shadow-sm">
        <h2 className="text-xl font-bold">SW Release Note</h2>
        <p className="mt-2 text-sm leading-relaxed text-blue-100">
          SW Release Note를 작성합니다.
          <br />
          최종 DOCX는 생성 날짜 기준으로 파일명이 생성됩니다.
        </p>
      </div>

      <section className={sectionCardClass}>
        <h2 className={sectionTitleClass}>📋 기본 정보</h2>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label>
            <span className={labelClass}>Site</span>
            <input value={displaySite} readOnly className={readonlyInputClass} />
          </label>
          <label>
            <span className={labelClass}>Release Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className={inputClass}
              {...fieldProps}
            />
          </label>
        </div>

        <h3 className={subTitleClass}>SW 버전 정보</h3>

        <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label>
            <span className={labelClass}>XEA Version (Before → After)</span>
            <div className="flex items-center gap-2">
              <input
                value={xeaBefore}
                onChange={(e) => onXeaBeforeChange(e.target.value)}
                placeholder="예: 5.2.5 Dev3475"
                className={inputClass}
                {...fieldProps}
              />
              <span className="font-bold text-park-blue">→</span>
              <input
                value={xeaAfter}
                onChange={(e) => onXeaAfterChange(e.target.value)}
                placeholder="예: 5.2.5 Dev3584"
                className={inputClass}
                {...fieldProps}
              />
            </div>
          </label>

          <label>
            <span className={labelClass}>XES Version (Before → After)</span>
            <div className="flex items-center gap-2">
              <input
                value={xesBefore}
                onChange={(e) => onXesBeforeChange(e.target.value)}
                placeholder="예: 5.2.5 Dev1525"
                className={inputClass}
                {...fieldProps}
              />
              <span className="font-bold text-park-blue">→</span>
              <input
                value={xesAfter}
                onChange={(e) => onXesAfterChange(e.target.value)}
                placeholder="예: 5.2.5 Dev1533"
                className={inputClass}
                {...fieldProps}
              />
            </div>
          </label>

          <label className="md:col-span-2 lg:col-span-1">
            <span className={labelClass}>CIM Version (없으면 비워두세요)</span>
            <input
              value={cimVer}
              onChange={(e) => onCimVerChange(e.target.value)}
              placeholder="예: 20260310"
              className={inputClass}
              {...fieldProps}
            />
          </label>
        </div>

        <h3 className={subTitleClass}>Release Overview (주요 Update 사항)</h3>

        <div className="mb-4 space-y-2">
          {overview.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className={rowIndexClass}>{index + 1}.</span>
              <input
                value={item}
                onChange={(e) => onOverviewChange(index, e.target.value)}
                placeholder="고객 관점의 핵심 변경 내용"
                className={inputClass}
                {...fieldProps}
              />
              <button
                type="button"
                onClick={() => onRemoveOverview(index)}
                disabled={readOnly}
                className={btnDanger}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <SectionAddButton label="+ 요약 항목 추가" onClick={onAddOverview} readOnly={readOnly} />
        </div>

        <SectionNavFooter readOnly={readOnly} onSave={onSave} onNext={onNext} />
      </section>
    </>
  );
}
