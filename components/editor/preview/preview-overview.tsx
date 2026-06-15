import { formatEmpty } from '@/lib/release-note-document-model';
import {
  previewTableClass,
  previewTdClass,
} from '@/components/editor/preview/preview-section-block';

type PreviewOverviewProps = {
  items: string[];
};

export function PreviewOverview({ items }: PreviewOverviewProps) {
  return (
    <table className={previewTableClass}>
      <tbody>
        <tr>
          <td className="border border-[#AAAAAA] bg-park-navy px-2 py-1.5 text-[10px] font-bold text-white sm:text-xs">
            Release Overview
          </td>
        </tr>
        {items.map((item, index) => (
          <tr key={index}>
            <td className={`${previewTdClass(index % 2 === 0 ? 'white' : 'alt')} text-left`}>
              <span className="font-bold text-park-navy">{index + 1}. </span>
              {formatEmpty(item)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
