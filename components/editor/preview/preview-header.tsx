import type { ReleaseNotePreviewData } from '@/components/editor/preview/preview-types';
import { formatEmpty, targetSystemLabel } from '@/lib/release-note-preview-utils';
import {
  previewTableClass,
  previewTdClass,
  previewThNavyClass,
} from '@/components/editor/preview/preview-section-block';

type PreviewHeaderProps = Pick<
  ReleaseNotePreviewData,
  'site' | 'date' | 'xeaBefore' | 'xeaAfter' | 'xesBefore' | 'xesAfter' | 'cimVer'
>;

export function PreviewHeader({
  site,
  date,
  xeaBefore,
  xeaAfter,
  xesBefore,
  xesAfter,
  cimVer,
}: PreviewHeaderProps) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Site', value: formatEmpty(site) },
    { label: 'Release Date', value: formatEmpty(date) },
    {
      label: 'SW Version (XEA)',
      value: (
        <>
          {formatEmpty(xeaBefore)}
          <span className="mx-1 font-bold text-[#2E5FA3]">→</span>
          <span className="font-bold text-park-navy">{formatEmpty(xeaAfter)}</span>
        </>
      ),
    },
    {
      label: 'SW Version (XES)',
      value: (
        <>
          {formatEmpty(xesBefore)}
          <span className="mx-1 font-bold text-[#2E5FA3]">→</span>
          <span className="font-bold text-park-navy">{formatEmpty(xesAfter)}</span>
        </>
      ),
    },
    { label: 'Target System', value: targetSystemLabel(cimVer) },
  ];

  return (
    <table className={previewTableClass}>
      <tbody>
        <tr>
          <td
            colSpan={2}
            className="border border-[#AAAAAA] bg-park-navy px-3 py-4 text-center"
          >
            <div className="text-lg font-bold text-white sm:text-xl">SW Release Note</div>
            <div className="mt-1 text-[10px] text-[#D9E1F2] sm:text-xs">
              Park Systems Corporation
            </div>
          </td>
        </tr>
        {rows.map((row) => (
          <tr key={row.label}>
            <th className={`${previewThNavyClass} w-[30%]`}>{row.label}</th>
            <td className={`${previewTdClass('white')} text-left`}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
