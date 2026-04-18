import { createServerClient } from '@/lib/supabase';

function normalizeSite(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '_');
}

function normalizeEquipment(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '');
}

type DetailItem = { ref?: string; category?: string; title?: string; desc?: string };
type NoteItem = { icon?: string; text?: string };
type HistoryItem = { date?: string; xea?: string; xes?: string; cim?: string; summary?: string };

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const site = normalizeSite(body.site);
    const equipment = normalizeEquipment(body.equipment);

    if (!site || !equipment) {
      return Response.json(
        { ok: false, message: 'site, equipment 필요' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const now = new Date().toISOString();

    // 메인 노트 upsert (created_at 미포함 → 신규 시 DB default, 갱신 시 유지)
    const { data: note, error: noteError } = await supabase
      .from('notes')
      .upsert(
        {
          site,
          equipment,
          date: body.date ?? '',
          xea_before: body.xeaBefore ?? '',
          xea_after: body.xeaAfter ?? '',
          xes_before: body.xesBefore ?? '',
          xes_after: body.xesAfter ?? '',
          cim_ver: body.cimVer ?? '',
          updated_at: now,
          // Phase 2에서 getCurrentActor()로 대체
          updated_by: body.updatedBy ?? body.lastModifiedBy ?? '',
        },
        { onConflict: 'site,equipment' }
      )
      .select('id')
      .single();

    if (noteError) throw noteError;

    const noteId = note.id as string;

    // 자식 테이블 전체 삭제 후 재삽입 (순서 보장)
    await Promise.all([
      supabase.from('overview_items').delete().eq('note_id', noteId),
      supabase.from('detail_rows').delete().eq('note_id', noteId),
      supabase.from('note_items').delete().eq('note_id', noteId),
      supabase.from('history_rows').delete().eq('note_id', noteId),
    ]);

    const overview: string[] = Array.isArray(body.overview) ? body.overview : [];
    const xeaDetails: DetailItem[] = Array.isArray(body.xeaDetails) ? body.xeaDetails : [];
    const xesDetails: DetailItem[] = Array.isArray(body.xesDetails) ? body.xesDetails : [];
    const testVersions: DetailItem[] = Array.isArray(body.testVersions) ? body.testVersions : [];
    const notes: NoteItem[] = Array.isArray(body.notes) ? body.notes : [];
    const history: HistoryItem[] = Array.isArray(body.history) ? body.history : [];

    const inserts: Promise<unknown>[] = [];

    if (overview.length > 0) {
      inserts.push(
        supabase.from('overview_items').insert(
          overview.map((text, i) => ({ note_id: noteId, sort_order: i, text: text ?? '' }))
        )
      );
    }

    const detailRows = [
      ...xeaDetails.map((d, i) => ({
        note_id: noteId, type: 'xea', sort_order: i,
        ref: d.ref ?? '', category: d.category ?? '', title: d.title ?? '', desc: d.desc ?? '',
      })),
      ...xesDetails.map((d, i) => ({
        note_id: noteId, type: 'xes', sort_order: i,
        ref: d.ref ?? '', category: d.category ?? '', title: d.title ?? '', desc: d.desc ?? '',
      })),
      ...testVersions.map((d, i) => ({
        note_id: noteId, type: 'test', sort_order: i,
        ref: d.ref ?? '', category: d.category ?? '', title: d.title ?? '', desc: d.desc ?? '',
      })),
    ];
    if (detailRows.length > 0) {
      inserts.push(supabase.from('detail_rows').insert(detailRows));
    }

    if (notes.length > 0) {
      inserts.push(
        supabase.from('note_items').insert(
          notes.map((n, i) => ({
            note_id: noteId, sort_order: i,
            icon: n.icon ?? '!', text: n.text ?? '',
          }))
        )
      );
    }

    if (history.length > 0) {
      inserts.push(
        supabase.from('history_rows').insert(
          history.map((h, i) => ({
            note_id: noteId, sort_order: i,
            date: h.date ?? '', xea: h.xea ?? '', xes: h.xes ?? '',
            cim: h.cim ?? '', summary: h.summary ?? '',
          }))
        )
      );
    }

    await Promise.all(inserts);

    return Response.json({
      ok: true,
      message: '저장 완료',
      file: `${site}_${equipment}.json`,
    });
  } catch (err) {
    console.error('[test-save]', err);
    return Response.json({ ok: false, message: '저장 실패' }, { status: 500 });
  }
}
