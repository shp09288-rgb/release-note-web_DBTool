import { createServerClient } from '@/lib/supabase';
import { getCurrentActor } from '@/lib/auth-adapter';
import { toSaveErrorBody, type SaveStage } from '@/lib/note-save';
import {
  buildSyntheticFileName,
  normalizeEquipment,
  normalizeSite,
  pickExistingNoteByNormalizedKey,
  siteLookupCandidates,
} from '@/lib/note-utils';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function saveError(stage: SaveStage, err: unknown, status = 500) {
  return Response.json(toSaveErrorBody(stage, err), { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const actor = await getCurrentActor(req);
    const updatedBy = String(body.updatedBy || actor.name || 'Anonymous').trim() || 'Anonymous';

    const site = normalizeSite(body.site);
    const equipment = normalizeEquipment(body.equipment);

    if (!site || !equipment) {
      return Response.json(
        {
          ok: false,
          stage: 'validate' as const,
          message: 'site/equipment 누락',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const notePayload = {
      site,
      equipment,
      date: String(body.date || ''),
      xea_before: String(body.xeaBefore || ''),
      xea_after: String(body.xeaAfter || ''),
      xes_before: String(body.xesBefore || ''),
      xes_after: String(body.xesAfter || ''),
      cim_ver: String(body.cimVer || ''),
      updated_by: updatedBy,
    };

    const { data: candidateRows, error: selectError } = await supabase
      .from('notes')
      .select('id, site, equipment, updated_at')
      .in('site', siteLookupCandidates(site));

    if (selectError) {
      return saveError('notes-select', selectError);
    }

    const existingNote = pickExistingNoteByNormalizedKey(candidateRows ?? [], site, equipment);

    let noteId: string;

    if (existingNote) {
      const { data: updated, error: updateError } = await supabase
        .from('notes')
        .update(notePayload)
        .eq('id', existingNote.id)
        .select('id')
        .single();

      if (updateError) {
        return saveError('notes-update', updateError);
      }

      noteId = updated.id as string;
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('notes')
        .insert(notePayload)
        .select('id')
        .single();

      if (insertError) {
        return saveError('notes-insert', insertError);
      }

      noteId = inserted.id as string;
    }

    const deleteTargets = ['overview_items', 'detail_rows', 'note_items', 'history_rows'] as const;
    for (const table of deleteTargets) {
      const { error } = await supabase.from(table).delete().eq('note_id', noteId);
      if (error) {
        return saveError('child-delete', { ...error, message: `${table}: ${error.message}` });
      }
    }

    const overviewRows = asArray<string>(body.overview)
      .map((text, idx) => ({ note_id: noteId, sort_order: idx, text: String(text || '') }))
      .filter((row) => row.text.trim() !== '');
    if (overviewRows.length) {
      const { error } = await supabase.from('overview_items').insert(overviewRows);
      if (error) {
        return saveError('overview-insert', error);
      }
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
      ...asArray<any>(body.cimDetails).map((row, idx) => ({
        note_id: noteId,
        type: 'cim',
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
      if (error) {
        return saveError('detail-insert', error);
      }
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
      if (error) {
        return saveError('note-items-insert', error);
      }
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
      if (error) {
        return saveError('history-insert', error);
      }
    }

    return Response.json({
      ok: true,
      message: '저장 완료',
      stage: existingNote ? 'notes-update' : 'notes-insert',
      file: buildSyntheticFileName(site, equipment),
      noteId,
      updatedBy,
    });
  } catch (err) {
    console.error('[test-save]', err);
    return saveError('unknown', err);
  }
}
