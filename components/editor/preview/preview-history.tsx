import type { HistoryRow } from '@/components/editor/types';
import {
  buildHistoryVersionLines,
  formatEmpty,
  splitLines,
} from '@/lib/release-note-document-model';
import {
  previewTableClass,
  previewTdClass,
  previewThNavyClass,
} from '@/components/editor/preview/preview-section-block';

type PreviewHistoryProps = {
  history: HistoryRow[];
};

export function PreviewHistory({ history }: PreviewHistoryProps) {
  if (!history.length) {
    return (
      <table className={previewTableClass}>
        <tbody>
          <tr>
            <th className={`${previewThNavyClass} w-[13%]`}>Date</th>
            <th className={`${previewThNavyClass} w-[20%]`}>Version</th>
            <th className={`${previewThNavyClass} w-[67%]`}>주요 변경 내용</th>
          </tr>
          <tr>
            <td colSpan={3} className={`${previewTdClass('white')} text-center`}>
              이력 없음
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table className={previewTableClass}>
      <tbody>
        <tr>
          <th className={`${previewThNavyClass} w-[13%]`}>Date</th>
          <th className={`${previewThNavyClass} w-[20%]`}>Version</th>
          <th className={`${previewThNavyClass} w-[67%]`}>주요 변경 내용</th>
        </tr>
        {history.map((row, index) => {
          const isTop = index === 0;
          const bg = isTop ? 'head' : index % 2 === 0 ? 'white' : 'alt';
          const weight = isTop ? 'font-bold' : '';
          const versionLines = buildHistoryVersionLines(row);
          const summaryLines = splitLines(row.summary);

          return (
            <tr key={index}>
              <td className={`${previewTdClass(bg)} text-center ${weight}`}>
                {formatEmpty(row.date)}
              </td>
              <td className={`${previewTdClass(bg)} ${weight}`}>
                {versionLines.length > 0 ? (
                  versionLines.map((line, lineIndex) => (
                    <p key={lineIndex} className={lineIndex > 0 ? 'mt-1' : ''}>
                      {line}
                    </p>
                  ))
                ) : (
                  '-'
                )}
              </td>
              <td className={`${previewTdClass(bg)} ${weight}`}>
                {summaryLines.length > 0 ? (
                  summaryLines.map((line, lineIndex) => (
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
  );
}
