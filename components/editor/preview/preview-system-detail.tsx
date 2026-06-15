import type { DetailRow } from '@/components/editor/types';
import { formatEmpty, getCategoryColorClass, splitLines } from '@/lib/release-note-document-model';
import {
  previewTableClass,
  previewTdClass,
  previewThClass,
} from '@/components/editor/preview/preview-section-block';

type PreviewSystemDetailProps = {
  label: string;
  subLabel?: string;
  items: DetailRow[];
  before: string;
  after: string;
};

export function PreviewSystemDetail({
  label,
  subLabel,
  items,
  before,
  after,
}: PreviewSystemDetailProps) {
  if (!items.length) return null;

  return (
    <div className="space-y-1">
      {subLabel ? (
        <p className="text-[10px] font-bold text-park-navy sm:text-xs">{subLabel}</p>
      ) : null}
      <table className={previewTableClass}>
        <tbody>
          <tr>
            <td
              colSpan={4}
              className="border border-[#AAAAAA] bg-park-navy px-2 py-1.5 text-left text-[10px] font-bold text-white sm:text-xs"
            >
              {label}{' '}
              <span className="font-normal text-[#D9E1F2]">
                {formatEmpty(before)} → {formatEmpty(after)}
              </span>
            </td>
          </tr>
          <tr>
            <th className={`${previewThClass} w-[14%]`}>Reference</th>
            <th className={`${previewThClass} w-[16%]`}>Category</th>
            <th className={`${previewThClass} w-[33%]`}>Item</th>
            <th className={`${previewThClass} w-[37%]`}>Description</th>
          </tr>
          {items.map((row, index) => {
            const descLines = splitLines(row.desc);
            const bg = index % 2 === 0 ? 'white' : 'alt';

            return (
              <tr key={index}>
                <td className={`${previewTdClass(bg)} text-center text-[#2E5FA3]`}>
                  {formatEmpty(row.ref)}
                </td>
                <td className={`${previewTdClass(bg)} text-center`}>
                  <span className={`font-bold ${getCategoryColorClass(row.category)}`}>
                    {formatEmpty(row.category)}
                  </span>
                </td>
                <td className={`${previewTdClass(bg)} text-center font-bold`}>
                  {formatEmpty(row.title)}
                </td>
                <td className={previewTdClass(bg)}>
                  {descLines.length > 0 ? (
                    descLines.map((line, lineIndex) => (
                      <p key={lineIndex} className={lineIndex > 0 ? 'mt-1' : ''}>
                        {line}
                      </p>
                    ))
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
