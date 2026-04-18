import { createServerClient } from '@/lib/supabase';
import { LOCK_STALE_MS } from '@/lib/lock-utils';

export async function GET() {
  try {
    const supabase = createServerClient();

    // 4개 테이블을 병렬 조회
    const [notesResult, overviewResult, historyResult, locksResult] =
      await Promise.all([
        supabase.from('notes').select('*'),
        supabase.from('overview_items').select('note_id'),
        supabase.from('history_rows').select('note_id'),
        supabase.from('edit_locks').select('*'),
      ]);

    const notes = notesResult.data ?? [];
    const overviewItems = overviewResult.data ?? [];
    const historyItems = historyResult.data ?? [];
    const locks = locksResult.data ?? [];

    // note_id별 개수 집계
    const overviewCounts = new Map<string, number>();
    const historyCounts = new Map<string, number>();
    overviewItems.forEach((r) =>
      overviewCounts.set(r.note_id, (overviewCounts.get(r.note_id) ?? 0) + 1)
    );
    historyItems.forEach((r) =>
      historyCounts.set(r.note_id, (historyCounts.get(r.note_id) ?? 0) + 1)
    );

    // 락 맵 (site__equipment → 락 정보)
    type LockEntry = {
      user_name: string;
      updated_at: string;
      stale: boolean;
    };
    const lockMap = new Map<string, LockEntry>();
    locks.forEach((lock) => {
      const age = Date.now() - new Date(lock.updated_at as string).getTime();
      lockMap.set(`${lock.site}__${lock.equipment}`, {
        user_name: lock.user_name as string,
        updated_at: lock.updated_at as string,
        stale: age > LOCK_STALE_MS,
      });
    });

    const items = notes.map((note) => {
      const overviewCount = overviewCounts.get(note.id as string) ?? 0;
      const historyCount = historyCounts.get(note.id as string) ?? 0;
      const hasOverview = overviewCount > 0;
      const hasHistory = historyCount > 0;
      const hasData =
        hasOverview ||
        hasHistory ||
        !!(note.date as string) ||
        !!(note.xea_after as string) ||
        !!(note.xes_after as string) ||
        !!(note.cim_ver as string);

      const lock = lockMap.get(`${note.site}__${note.equipment}`);

      const status = lock
        ? lock.stale
          ? 'stale_lock'
          : 'locked'
        : hasData
        ? 'editable'
        : 'no_data';

      return {
        // file 필드: 프론트 호환성 유지 (delete/rename 시 식별자로 사용)
        file: `${note.site}_${note.equipment}.json`,
        site: note.site as string,
        equipment: note.equipment as string,
        date: (note.date as string) ?? '',
        xeaAfter: (note.xea_after as string) ?? '',
        xesAfter: (note.xes_after as string) ?? '',
        cimVer: (note.cim_ver as string) ?? '',
        hasOverview,
        hasHistory,
        overviewCount,
        historyCount,
        updatedAt: (note.updated_at as string) ?? '',
        status,
        lockUser: lock?.user_name ?? '',
        lockUpdatedAt: lock?.updated_at ?? '',
        lockStale: !!lock?.stale,
      };
    });

    items.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

    return Response.json({ ok: true, items });
  } catch (err) {
    console.error('[list-notes]', err);
    return Response.json({ ok: false, items: [] });
  }
}
