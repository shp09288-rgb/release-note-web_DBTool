import type { NoteRow } from '@/components/editor/types';
import { getNoteIconClass, splitLines } from '@/lib/release-note-preview-utils';
import {
  previewTableClass,
  previewTdClass,
} from '@/components/editor/preview/preview-section-block';

type PreviewNotesProps = {
  notes: NoteRow[];
};

export function PreviewNotes({ notes }: PreviewNotesProps) {
  const items = notes.length > 0 ? notes : [{ icon: '!' as const, text: '' }];

  return (
    <table className={previewTableClass}>
      <tbody>
        <tr>
          <td className="border border-[#AAAAAA] bg-park-navy px-2 py-1.5 text-[10px] font-bold text-white sm:text-xs">
            Important Notes
          </td>
        </tr>
        {items.map((note, index) => {
          const lines = splitLines(note.text);
          const bg = index % 2 === 0 ? 'white' : 'alt';
          const iconClass = getNoteIconClass(note.icon);

          return (
            <tr key={index}>
              <td className={`${previewTdClass(bg)} text-left`}>
                {lines.length > 0 ? (
                  lines.map((line, lineIndex) => (
                    <p key={lineIndex} className={lineIndex > 0 ? 'mt-1 pl-5' : ''}>
                      {lineIndex === 0 ? (
                        <>
                          <span className={`font-bold ${iconClass}`}>[{note.icon}]</span>{' '}
                          {line}
                        </>
                      ) : (
                        line
                      )}
                    </p>
                  ))
                ) : (
                  <span>
                    <span className={`font-bold ${iconClass}`}>[{note.icon}]</span> -
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
