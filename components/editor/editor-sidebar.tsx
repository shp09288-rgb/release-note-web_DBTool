import Link from 'next/link';
import { EDITOR_NAV_ITEMS, type SectionKey } from './types';

type EditorSidebarProps = {
  activeSection: SectionKey;
  onSectionChange: (key: SectionKey) => void;
};

export function EditorSidebar({ activeSection, onSectionChange }: EditorSidebarProps) {
  return (
    <aside className="hidden w-56 shrink-0 bg-park-navy lg:block xl:w-60">
      <nav className="flex flex-col py-4">
        {EDITOR_NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSectionChange(item.key)}
              className={[
                'flex w-full items-center gap-2.5 border-l-[3px] px-5 py-3 text-left text-sm transition',
                isActive
                  ? 'border-blue-300 bg-[#2E5FA3] font-bold text-white'
                  : 'border-transparent text-blue-200 hover:bg-white/5 hover:text-white',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                  isActive ? 'bg-park-blue text-white' : 'bg-[#2E5FA3] text-white',
                ].join(' ')}
              >
                {item.num}
              </span>
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="px-4 pb-4">
        <Link
          href="/dashboard"
          className="block rounded-lg bg-[#6F42C1] px-3 py-2.5 text-center text-xs font-bold text-white transition hover:brightness-110"
        >
          설비 대시보드
        </Link>
      </div>
    </aside>
  );
}
