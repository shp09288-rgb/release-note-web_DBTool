import { createServerClient } from '@/lib/supabase';
import { deleteExpiredLocks } from '@/lib/lock-utils';
import { buildSyntheticFileName, normalizeEquipment, normalizeSite } from '@/lib/note-utils';

type NoteRow = {
  id: string;
  site: string;
  equipment: string;
  date: string;
  xea_after: string;
  xes_after: string;
  cim_ver: string;
  updated_at: string;
};

type ChildCountRow = {
  note_id: string;
};

type LockRow = {
  site: string;
  equipment: string;
  user_name: string;
  updated_at: string;
  expires_at: string;
};

export async function GET() {
  try {
    const supabase = createServerClient();

    // 만료된 편집 락은 대시보드 표시 전에 정리한다.
    // 브라우저 종료/네트워크 끊김으로 release-lock이 실패해도 10분 뒤 자동 복구된다.
    await deleteExpiredLocks();

    const [
      { data: notes, error: notesError },
      { data: overviewRows, error: overviewError },
      { data: historyRows, error: historyError },
      { data: locks, error: locksError },
    ] = await Promise.all([
      supabase
        .from('notes')
        .select('id, site, equipment, date, xea_after, xes_after, cim_ver, updated_at')
        .order('updated_at', { ascending: false }),
      supabase.from('overview_items').select('note_id'),
      supabase.from('history_rows').select('note_id'),
      supabase.from('edit_locks').select('site, equipment, user_name, updated_at, expires_at'),
    ]);

    if (notesError) throw notesError;
    if (overviewError) throw overviewError;
    if (historyError) throw historyError;
    if (locksError) throw locksError;

    const overviewCountMap = new Map<string, number>();
    for (const row of (overviewRows || []) as ChildCountRow[]) {
      overviewCountMap.set(row.note_id, (overviewCountMap.get(row.note_id) || 0) + 1);
    }

    const historyCountMap = new Map<string, number>();
    for (const row of (historyRows || []) as ChildCountRow[]) {
      historyCountMap.set(row.note_id, (historyCountMap.get(row.note_id) || 0) + 1);
    }

    const lockMap = new Map<string, LockRow>();
    for (const lock of (locks || []) as LockRow[]) {
      lockMap.set(`${normalizeSite(lock.site)}__${normalizeEquipment(lock.equipment)}`, lock);
    }

    const enrichedItems = ((notes || []) as NoteRow[]).map((note) => {
      const key = `${normalizeSite(note.site)}__${normalizeEquipment(note.equipment)}`;
      const lock = lockMap.get(key);
      const stale = lock?.expires_at ? new Date(lock.expires_at).getTime() < Date.now() : false;
      const overviewCount = overviewCountMap.get(note.id) || 0;
      const historyCount = historyCountMap.get(note.id) || 0;
      const hasData =
        overviewCount > 0 ||
        historyCount > 0 ||
        !!String(note.date || '').trim() ||
        !!String(note.xea_after || '').trim() ||
        !!String(note.xes_after || '').trim() ||
        !!String(note.cim_ver || '').trim();

      const status = lock && !stale ? 'locked' : hasData ? 'editable' : 'no_data';

      return {
        noteId: note.id,
        normalizedKey: key,
        file: buildSyntheticFileName(note.site, note.equipment),
        site: note.site,
        equipment: note.equipment,
        date: note.date || '',
        xeaAfter: note.xea_after || '',
        xesAfter: note.xes_after || '',
        cimVer: note.cim_ver || '',
        hasOverview: overviewCount > 0,
        hasHistory: historyCount > 0,
        overviewCount,
        historyCount,
        hasData,
        updatedAt: note.updated_at || '',
        status,
        lockUser: lock?.user_name || '',
        lockUpdatedAt: lock?.updated_at || '',
        lockStale: stale,
      };
    });

    // 같은 Site/Equipment가 중복 생성되어도 대시보드에서는 1장만 보이게 한다.
    // 우선순위: 데이터가 있는 카드 > 최근 수정 카드.
    const dedupedMap = new Map<string, typeof enrichedItems[number]>();
    for (const item of enrichedItems) {
      const previous = dedupedMap.get(item.normalizedKey);
      if (!previous) {
        dedupedMap.set(item.normalizedKey, item);
        continue;
      }

      const previousTime = previous.updatedAt ? new Date(previous.updatedAt).getTime() : 0;
      const currentTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const shouldReplace =
        (item.hasData && !previous.hasData) ||
        (item.hasData === previous.hasData && currentTime > previousTime);

      if (shouldReplace) {
        dedupedMap.set(item.normalizedKey, item);
      }
    }

    const items = Array.from(dedupedMap.values()).map((item) => ({
      noteId: item.noteId,
      file: item.file,
      site: item.site,
      equipment: item.equipment,
      date: item.date,
      xeaAfter: item.xeaAfter,
      xesAfter: item.xesAfter,
      cimVer: item.cimVer,
      hasOverview: item.hasOverview,
      hasHistory: item.hasHistory,
      overviewCount: item.overviewCount,
      historyCount: item.historyCount,
      updatedAt: item.updatedAt,
      status: item.status,
      lockUser: item.lockUser,
      lockUpdatedAt: item.lockUpdatedAt,
      lockStale: item.lockStale,
    }));

    return Response.json({ ok: true, items });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, items: [] }, { status: 500 });
  }
}
