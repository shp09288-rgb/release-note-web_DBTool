import { EDITOR_NAV_ITEMS, type SectionKey } from './types';

type EditorMobileNavProps = {
  activeSection: SectionKey;
  onSectionChange: (key: SectionKey) => void;
};

export function EditorMobileNav({ activeSection, onSectionChange }: EditorMobileNavProps) {
  return (
    <nav className="border-b border-park-border bg-white lg:hidden">
      <div className="flex gap-2 overflow-x-auto px-3 py-3">
        {EDITOR_NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSectionChange(item.key)}
              className={[
                'shrink-0 rounded-full px-3 py-2 text-xs font-bold transition',
                isActive
                  ? 'bg-park-navy text-white'
                  : 'border border-park-border bg-park-surface text-slate-600 hover:border-park-blue',
              ].join(' ')}
            >
              {item.num}. {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
