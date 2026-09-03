import Link from 'next/link';

const NAV = [
  { href: '/', label: '설비 목록' },
  { href: '/search', label: '검색' },
  { href: '/upload', label: '업로드' },
];

/**
 * 모든 화면 위에 공통으로 얹히는 헤더.
 *
 * 네이비 바탕에 시안 강조선 — 브랜드 느낌은 시안이 만들고 읽히는 것은 네이비가 맡는다.
 * park-accent 는 밝아서 흰 글씨를 얹으면 대비가 부족하므로 바탕색으로 쓰지 않는다.
 */
export function SiteHeader() {
  return (
    <header className="border-b-2 border-park-accent bg-park-navy">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="text-sm font-bold tracking-wide text-white">PARK SYSTEMS</span>
          <span className="text-park-accent" aria-hidden>
            |
          </span>
          <span className="text-sm font-semibold text-white/90">SW 버전 이력</span>
        </Link>

        <nav className="ml-auto flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
