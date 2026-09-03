import Link from 'next/link';
import { SearchPanel } from '@/components/history/search-panel';

export default function SearchPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-park-muted hover:underline">
        ← 설비 목록
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">PMS · 키워드 검색</h1>
        <p className="mt-1 text-sm text-park-muted">
          해당 개선이 어느 사이트 · 어느 버전에 들어갔는지 찾습니다.
        </p>
      </header>
      <SearchPanel />
    </main>
  );
}
