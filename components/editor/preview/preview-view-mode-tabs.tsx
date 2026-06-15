import type { EditorViewMode } from '@/components/editor/preview/preview-types';

type PreviewViewModeTabsProps = {
  mode: EditorViewMode;
  onModeChange: (mode: EditorViewMode) => void;
};

export function PreviewViewModeTabs({ mode, onModeChange }: PreviewViewModeTabsProps) {
  return (
    <div
      className="flex border-b border-park-border bg-white lg:hidden"
      role="tablist"
      aria-label="편집 또는 미리보기"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'edit'}
        onClick={() => onModeChange('edit')}
        className={[
          'flex-1 px-4 py-3 text-sm font-bold transition',
          mode === 'edit'
            ? 'border-b-2 border-park-navy text-park-navy'
            : 'text-slate-500 hover:text-slate-700',
        ].join(' ')}
      >
        편집
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'preview'}
        onClick={() => onModeChange('preview')}
        className={[
          'flex-1 px-4 py-3 text-sm font-bold transition',
          mode === 'preview'
            ? 'border-b-2 border-park-navy text-park-navy'
            : 'text-slate-500 hover:text-slate-700',
        ].join(' ')}
      >
        미리보기
      </button>
    </div>
  );
}
