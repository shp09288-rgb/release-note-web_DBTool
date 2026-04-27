import { createServerClient } from '@/lib/supabase';
import { getCurrentActor } from '@/lib/auth-adapter';
import { normalizeEquipment, normalizeSite, buildSyntheticFileName } from '@/lib/note-utils';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const actor = await getCurrentActor(req);
    const updatedBy = String(body.updatedBy || actor.name || 'Anonymous').trim() || 'Anonymous';

    const site = normalizeSite(body.site);
    const equipment = normalizeEquipment(body.equipment);

    if (!site || !equipment) {
      return Response.json({ ok: false, message: 'site/equipment 누락' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: upserted, error: upsertError } = await supabase
      .from('notes')
      .upsert(
        {
          site,
          equipment,
          date: String(body.date || ''),
          xea_before: String(body.xeaBefore || ''),
          xea_after: String(body.xeaAfter || ''),
          xes_before: String(body.xesBefore || ''),
          xes_after: String(body.xesAfter || ''),
          cim_ver: String(body.cimVer || ''),
          updated_by: updatedBy,
        },
        { onConflict: 'site,equipment' }
      )
      .select('id')
      .single();

    if (upsertError) throw upsertError;
    const noteId = upserted.id as string;

    const deleteTargets = ['overview_items', 'detail_rows', 'note_items', 'history_rows'] as const;
    for (const table of deleteTargets) {
      const { error } = await supabase.from(table).delete().eq('note_id', noteId);
      if (error) throw error;
    }

    const overviewRows = asArray<string>(body.overview)
      .map((text, idx) => ({ note_id: noteId, sort_order: idx, text: String(text || '') }))
      .filter((row) => row.text.trim() !== '');
    if (overviewRows.length) {
      const { error } = await supabase.from('overview_items').insert(overviewRows);
      if (error) throw error;
    }

    const detailRows = [
      ...asArray<any>(body.xeaDetails).map((row, idx) => ({
        note_id: noteId,
        type: 'xea',
        ref: String(row?.ref || ''),
        category: String(row?.category || ''),
        title: String(row?.title || ''),
        desc: String(row?.desc || ''),
        sort_order: idx,
      })),
      ...asArray<any>(body.xesDetails).map((row, idx) => ({
        note_id: noteId,
        type: 'xes',
        ref: String(row?.ref || ''),
        category: String(row?.category || ''),
        title: String(row?.title || ''),
        desc: String(row?.desc || ''),
        sort_order: idx,
      })),
      ...asArray<any>(body.testVersions).map((row, idx) => ({
        note_id: noteId,
        type: 'test',
        ref: String(row?.ref || row?.label || ''),
        category: String(row?.category || ''),
        title: String(row?.title || row?.version || ''),
        desc: String(row?.desc || row?.change || ''),
        sort_order: idx,
      })),
    ].filter((row) => row.ref || row.title || row.desc || row.category);
    if (detailRows.length) {
      const { error } = await supabase.from('detail_rows').insert(detailRows);
      if (error) throw error;
    }

    const noteRows = asArray<any>(body.notes)
      .map((row, idx) => ({
        note_id: noteId,
        icon: row?.icon === 'i' ? 'i' : '!',
        text: String(row?.text || ''),
        sort_order: idx,
      }))
      .filter((row) => row.text.trim() !== '');
    if (noteRows.length) {
      const { error } = await supabase.from('note_items').insert(noteRows);
      if (error) throw error;
    }

    const historyRows = asArray<any>(body.history)
      .map((row, idx) => ({
        note_id: noteId,
        date: String(row?.date || ''),
        xea: String(row?.xea || ''),
        xes: String(row?.xes || ''),
        cim: String(row?.cim || ''),
        summary: String(row?.summary || ''),
        sort_order: idx,
      }))
      .filter((row) => row.date || row.xea || row.xes || row.cim || row.summary);
    if (historyRows.length) {
      const { error } = await supabase.from('history_rows').insert(historyRows);
      if (error) throw error;
    }

    return Response.json({
      ok: true,
      message: '저장 완료',
      file: buildSyntheticFileName(site, equipment),
      noteId,
      updatedBy,
    });
  } catch (err) {
    console.error('[test-save]', err);
    return Response.json({ ok: false, message: err instanceof Error ? err.message : '저장 실패' }, { status: 500 });
  }
}
