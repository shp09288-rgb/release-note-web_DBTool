'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedDocument } from '@/lib/parsers/types';
import type { DeploymentDraft } from '@/lib/queries/types';

type ParseResponse = {
  ok: boolean;
  fileName: string;
  document: ParsedDocument;
  duplicate: { id: string; deployedOn: string | null; message: string } | null;
  message?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDraft(res: ParseResponse, rawHtml: string): DeploymentDraft {
  const h = res.document.header;
  return {
    site: h.site ?? '',
    // 문서는 설비 번호를 담지 못한다 (site + model만 있음). 사람이 반드시 채워야
    // 하므로 그럴듯한 기본값을 넣지 않고 빈 문자열로 둔다 — commit API도 이를 요구한다.
    equipment: '',
    model: h.model ?? '',
    deployedOn: null,
    xeaFromRaw: h.xeaFromRaw,
    xeaFromBuild: h.xeaFromBuild,
    xeaToRaw: h.xeaToRaw,
    xeaToBuild: h.xeaToBuild,
    xesFromRaw: h.xesFromRaw,
    xesFromBuild: h.xesFromBuild,
    xesToRaw: h.xesToRaw,
    xesToBuild: h.xesToBuild,
    cimVer: '',
    author: h.author ?? '',
    sourceKind: 'html_upload',
    sourceFile: res.fileName,
    rawHtml,
    edited: false,
    items: res.document.items.map((i) => ({
      pmsNo: i.pmsNo,
      pmsExtra: i.pmsExtra,
      anchorId: i.anchorId,
      section: i.section,
      sectionNo: i.sectionNo,
      title: i.title,
      phenomenon: i.phenomenon,
      improvements: i.improvements,
      flags: i.flags,
      sortOrder: i.sortOrder,
    })),
    alarms: res.document.alarms,
  };
}

function Field({
  label,
  value,
  onChange,
  required,
  invalid,
  hint,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  invalid?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-park-navy ${
          invalid ? 'border-red-400' : 'border-park-border'
        }`}
      />
      {hint ? <span className="mt-1 block text-xs text-red-600">{hint}</span> : null}
    </label>
  );
}

export function UploadWizard() {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [draft, setDraft] = useState<DeploymentDraft | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touchedSave, setTouchedSave] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    setError('');
    try {
      const html = await file.text();
      const res = await fetch('/api/upload/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, fileName: file.name }),
      });
      const body = (await res.json()) as ParseResponse;
      if (!body.ok) throw new Error(body.message ?? '파싱 실패');
      setParsed(body);
      setDraft(toDraft(body, html));
      setTouchedSave(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파싱 실패');
    } finally {
      setBusy(false);
    }
  }

  function patch(next: Partial<DeploymentDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...next, edited: true } : prev));
  }

  function patchItem(index: number, next: Partial<DeploymentDraft['items'][number]>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item, i) => (i === index ? { ...item, ...next } : item));
      return { ...prev, items, edited: true };
    });
  }

  const dateValid = !!draft && DATE_RE.test(draft.deployedOn ?? '');
  const equipmentValid = !!draft && draft.equipment.trim().length > 0;
  const siteValid = !!draft && draft.site.trim().length > 0;
  const canSave = dateValid && equipmentValid && siteValid;

  async function commit() {
    if (!draft) return;
    setTouchedSave(true);
    if (!canSave) {
      setError('사이트 · 설비 번호 · 배포일을 모두 확인해주세요.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/upload/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, draft }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.message ?? '저장 실패');
      router.push(
        `/site/${encodeURIComponent(draft.site)}/${encodeURIComponent(draft.equipment)}`
      );
    } catch (err) {
      // 실패해도 draft·password는 그대로 state에 남는다 — 사용자가 고친 내용을 다시
      // 입력할 필요 없이 오류만 확인하고 다시 저장을 누르면 된다.
      setError(err instanceof Error ? err.message : '저장 실패');
      setBusy(false);
    }
  }

  const warningCount = parsed?.document.warnings.length ?? 0;

  if (!parsed || !draft) {
    return (
      <div className="rounded-2xl border border-dashed border-park-border bg-white p-12 text-center">
        <p className="mb-4 text-slate-600">유관부서가 준 SW Update 적용 내역 HTML을 올려주세요.</p>
        <input
          type="file"
          accept=".html,.htm"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
          className="mx-auto block text-sm"
        />
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {warningCount > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="mb-2 font-bold text-amber-800">확인이 필요한 항목 {warningCount}건</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {parsed.document.warnings.map((w, idx) => (
              <li key={idx}>
                <span className="font-semibold">{w.field}</span> — {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed.duplicate ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="font-semibold">
            참고용 경고{parsed.duplicate.deployedOn ? ` — 기존 배포일 ${parsed.duplicate.deployedOn}` : ''}
          </p>
          <p className="mt-1">{parsed.duplicate.message}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-park-border bg-white p-6">
        <h3 className="mb-4 font-bold text-park-navy">배포 정보</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="사이트"
            value={draft.site}
            onChange={(v) => patch({ site: v })}
            required
            invalid={touchedSave && !siteValid}
          />
          <Field
            label="설비"
            value={draft.equipment}
            onChange={(v) => patch({ equipment: v })}
            required
            invalid={touchedSave && !equipmentValid}
            hint={
              touchedSave && !equipmentValid
                ? '문서에는 설비 번호가 없습니다. 직접 입력해주세요 (예: EQ01).'
                : undefined
            }
          />
          <Field label="모델" value={draft.model} onChange={(v) => patch({ model: v })} />
          <Field
            label="배포일 (YYYY-MM-DD)"
            value={draft.deployedOn ?? ''}
            onChange={(v) => patch({ deployedOn: v || null })}
            required
            invalid={touchedSave && !dateValid}
            hint={
              touchedSave && !dateValid
                ? '문서에는 배포일이 없습니다. YYYY-MM-DD 형식으로 직접 입력해주세요. 비워두면 같은 버전의 다른 배포와 충돌해 덮어써질 수 있습니다.'
                : undefined
            }
          />
          <Field label="XEA 이전" value={draft.xeaFromRaw} onChange={(v) => patch({ xeaFromRaw: v })} />
          <Field label="XEA 이후" value={draft.xeaToRaw} onChange={(v) => patch({ xeaToRaw: v })} />
          <Field label="XES 이전" value={draft.xesFromRaw} onChange={(v) => patch({ xesFromRaw: v })} />
          <Field label="XES 이후" value={draft.xesToRaw} onChange={(v) => patch({ xesToRaw: v })} />
          <Field label="작성자" value={draft.author} onChange={(v) => patch({ author: v })} />
        </div>
      </section>

      <section className="rounded-2xl border border-park-border bg-white p-6">
        <h3 className="mb-4 font-bold text-park-navy">항목 {draft.items.length}건</h3>
        <div className="space-y-4">
          {draft.items.map((item, index) => (
            <div key={item.anchorId} className="rounded-xl border border-park-border p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold">{item.section}</span>
                {item.pmsNo ? (
                  <span>PMS #{item.pmsNo}</span>
                ) : (
                  <span className="text-amber-700">PMS 번호 없음</span>
                )}
                {/* 문서가 정의한 범례 문구로 보여준다. 유도 플래그(not_applied)는
                    원시 배지가 이미 같은 뜻을 보여주므로 건너뛴다. */}
                {item.flags
                  .filter((f) => parsed.document.legend[f])
                  .map((f) => (
                    <span key={f} className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">
                      {parsed.document.legend[f]}
                    </span>
                  ))}
              </div>
              <Field label="제목" value={item.title} onChange={(v) => patchItem(index, { title: v })} />
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">현상</span>
                <textarea
                  value={item.phenomenon}
                  onChange={(e) => patchItem(index, { phenomenon: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-park-border px-3 py-2 text-sm outline-none focus:border-park-navy"
                />
              </label>
              {item.improvements.map((group, gi) => (
                <label key={group.component} className="mt-3 block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    개선 · {group.component} (줄바꿈으로 구분)
                  </span>
                  <textarea
                    value={group.lines.join('\n')}
                    onChange={(e) => {
                      const improvements = item.improvements.map((g, i) =>
                        i === gi ? { ...g, lines: e.target.value.split('\n') } : g
                      );
                      patchItem(index, { improvements });
                    }}
                    rows={Math.min(6, group.lines.length + 1)}
                    className="w-full rounded-lg border border-park-border px-3 py-2 text-sm outline-none focus:border-park-navy"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-park-border bg-white p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold text-slate-500">업로드 비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-park-border px-3 py-2 text-sm outline-none focus:border-park-navy"
            />
          </label>
          <button
            type="button"
            onClick={commit}
            disabled={busy}
            className="rounded-lg bg-park-navy px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? '저장 중' : '확정 저장'}
          </button>
        </div>
        {touchedSave && !canSave ? (
          <p className="mt-3 text-sm text-amber-700">
            사이트 · 설비 번호 · 배포일(YYYY-MM-DD)을 모두 채워야 저장할 수 있습니다.
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </div>
  );
}
