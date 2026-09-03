'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SearchHit } from '@/lib/queries/types';

export function SearchPanel() {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term.trim())}`);
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setError(body.message ?? '검색 실패');
        setHits([]);
        return;
      }
      setHits(body.hits ?? []);
    } catch {
      setError('검색 실패');
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="PMS 번호(4952) 또는 키워드(Fatal Following Error)"
          className="flex-1 rounded-lg border border-park-border px-4 py-2.5 text-sm outline-none focus:border-park-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-park-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? '검색 중' : '검색'}
        </button>
      </form>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {hits === null ? null : hits.length === 0 ? (
        error ? null : (
          <p className="mt-8 text-center text-park-muted">결과가 없습니다.</p>
        )
      ) : (
        <ul className="mt-6 space-y-3">
          {hits.map((hit, idx) => (
            <li
              key={`${hit.deploymentId}-${hit.itemId ?? idx}`}
              className="rounded-2xl border border-park-border bg-white p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={`/site/${encodeURIComponent(hit.site)}/${encodeURIComponent(hit.equipment)}`}
                  className="rounded bg-park-navy px-2 py-0.5 font-bold text-white"
                >
                  {hit.site} / {hit.equipment}
                </Link>
                <span className="text-park-muted">{hit.deployedOn ?? '날짜 미상'}</span>
                <span className="font-mono text-park-muted">
                  XEA {hit.xeaToRaw || '-'} · XES {hit.xesToRaw || '-'}
                </span>
                {hit.notApplied ? (
                  <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                    미적용
                  </span>
                ) : null}
                {hit.sourceKind === 'legacy_json' ? (
                  <span className="rounded bg-park-surface px-2 py-0.5 text-park-muted">과거 기록</span>
                ) : null}
              </div>

              <h3 className="mt-2 font-semibold text-park-ink">
                {hit.pmsNo ? <span className="mr-2 text-park-navy">#{hit.pmsNo}</span> : null}
                {hit.title}
              </h3>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-park-ink">
                {hit.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
