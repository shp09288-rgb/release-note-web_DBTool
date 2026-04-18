/**
 * test-save — supabase.rpc('save_note') 단일 호출로 트랜잭션 보장
 *
 * 기존 방식: ① notes upsert → ② 자식 delete(Promise.all) → ③ 자식 insert(Promise.all)
 *   문제: ③ 중 하나라도 실패하면 자식이 부분적으로 비어있는 상태가 됨.
 *
 * 변경 후: save_note PL/pgSQL 함수가 ①②③을 단일 트랜잭션으로 실행.
 *   실패 시 Postgres가 전체 롤백 → 이전 데이터 유지.
 */
import { createServerClient } from '@/lib/supabase';

function normalizeSite(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '_');
}

function normalizeEquipment(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '');
}

type DetailItem = { ref?: string; category?: string; title?: string; desc?: string };
type NoteItem   = { icon?: string; text?: string };
type HistoryItem = { date?: string; xea?: string; xes?: string; cim?: string; summary?: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const site      = normalizeSite(body.site);
    const equipment = normalizeEquipment(body.equipment);

    if (!site || !equipment) {
      return Response.json(
        { ok: false, message: 'site, equipment 필요' },
        { status: 400 }
      );
    }

    const overview:      string[]      = Array.isArray(body.overview)      ? body.overview      : [];
    const xeaDetails:    DetailItem[]  = Array.isArray(body.xeaDetails)    ? body.xeaDetails    : [];
    const xesDetails:    DetailItem[]  = Array.isArray(body.xesDetails)     ? body.xesDetails    : [];
    const testVersions:  DetailItem[]  = Array.isArray(body.testVersions)   ? body.testVersions  : [];
    const notes:         NoteItem[]    = Array.isArray(body.notes)          ? body.notes         : [];
    const history:       HistoryItem[] = Array.isArray(body.history)        ? body.history       : [];

    const toDetail = (d: DetailItem) => ({
      ref:      d.ref      ?? '',
      category: d.category ?? '',
      title:    d.title    ?? '',
      desc:     d.desc     ?? '',
    });

    const supabase = createServerClient();

    // PL/pgSQL 함수 호출 — 내부 전체가 단일 Postgres 트랜잭션
    const { error } = await supabase.rpc('save_note', {
      p_site:          site,
      p_equipment:     equipment,
      p_date:          body.date          ?? '',
      p_xea_before:    body.xeaBefore     ?? '',
      p_xea_after:     body.xeaAfter      ?? '',
      p_xes_before:    body.xesBefore     ?? '',
      p_xes_after:     body.xesAfter      ?? '',
      p_cim_ver:       body.cimVer        ?? '',
      // Phase 2에서 getCurrentActor()로 대체
      p_updated_by:    body.updatedBy ?? body.lastModifiedBy ?? '',
      p_overview:      overview.map((text) => ({ text: text ?? '' })),
      p_xea_details:   xeaDetails.map(toDetail),
      p_xes_details:   xesDetails.map(toDetail),
      p_test_versions: testVersions.map(toDetail),
      p_note_items:    notes.map((n) => ({ icon: n.icon ?? '!', text: n.text ?? '' })),
      p_history:       history.map((h) => ({
        date:    h.date    ?? '',
        xea:     h.xea     ?? '',
        xes:     h.xes     ?? '',
        cim:     h.cim     ?? '',
        summary: h.summary ?? '',
      })),
    });

    if (error) throw error;

    return Response.json({
      ok:      true,
      message: '저장 완료',
      file:    `${site}_${equipment}.json`,
    });
  } catch (err) {
    console.error('[test-save]', err);
    return Response.json({ ok: false, message: '저장 실패' }, { status: 500 });
  }
}
