import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function normalizeSite(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '_');
}

function normalizeEquipment(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '');
}

type DetailRow = { ref: string; category: string; title: string; desc: string };
type NoteItem = { icon: '!' | 'i'; text: string };
type HistoryRow = { date: string; xea: string; xes: string; cim: string; summary: string };

function emptyTemplate(site: string, equipment: string) {
  return {
    site,
    equipment,
    date: '',
    xeaBefore: '',
    xeaAfter: '',
    xesBefore: '',
    xesAfter: '',
    cimVer: '',
    overview: [''],
    xeaDetails: [] as DetailRow[],
    xesDetails: [] as DetailRow[],
    testVersions: [] as DetailRow[],
    notes: [] as NoteItem[],
    history: [] as HistoryRow[],
  };
}

export async function POST(req: Request) {
  try {
    const { site, equipment } = await req.json();

    const safeSite = normalizeSite(site);
    const safeEquipment = normalizeEquipment(equipment);

    const supabase = createServerClient();

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('*')
      .eq('site', safeSite)
      .eq('equipment', safeEquipment)
      .maybeSingle();

    if (noteError) throw noteError;

    if (!note) {
      return NextResponse.json({
        ok: true,
        data: emptyTemplate(site, equipment),
      });
    }

    // 자식 테이블 병렬 조회
    const [overviewResult, detailResult, noteItemsResult, historyResult] =
      await Promise.all([
        supabase
          .from('overview_items')
          .select('*')
          .eq('note_id', note.id)
          .order('sort_order'),
        supabase
          .from('detail_rows')
          .select('*')
          .eq('note_id', note.id)
          .order('sort_order'),
        supabase
          .from('note_items')
          .select('*')
          .eq('note_id', note.id)
          .order('sort_order'),
        supabase
          .from('history_rows')
          .select('*')
          .eq('note_id', note.id)
          .order('sort_order'),
      ]);

    const overviewRows = overviewResult.data ?? [];
    const detailRows = detailResult.data ?? [];
    const noteItems = noteItemsResult.data ?? [];
    const historyRows = historyResult.data ?? [];

    const toDetail = (r: Record<string, unknown>): DetailRow => ({
      ref: (r.ref as string) ?? '',
      category: (r.category as string) ?? '',
      title: (r.title as string) ?? '',
      desc: (r.desc as string) ?? '',
    });

    const data = {
      site: note.site as string,
      equipment: note.equipment as string,
      date: (note.date as string) ?? '',
      xeaBefore: (note.xea_before as string) ?? '',
      xeaAfter: (note.xea_after as string) ?? '',
      xesBefore: (note.xes_before as string) ?? '',
      xesAfter: (note.xes_after as string) ?? '',
      cimVer: (note.cim_ver as string) ?? '',
      overview: overviewRows.map((r) => (r.text as string) ?? ''),
      xeaDetails: detailRows.filter((r) => r.type === 'xea').map(toDetail),
      xesDetails: detailRows.filter((r) => r.type === 'xes').map(toDetail),
      testVersions: detailRows.filter((r) => r.type === 'test').map(toDetail),
      notes: noteItems.map((n) => ({
        icon: ((n.icon as string) ?? '!') as '!' | 'i',
        text: (n.text as string) ?? '',
      })),
      history: historyRows.map((h) => ({
        date: (h.date as string) ?? '',
        xea: (h.xea as string) ?? '',
        xes: (h.xes as string) ?? '',
        cim: (h.cim as string) ?? '',
        summary: (h.summary as string) ?? '',
      })),
    };

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[load-note]', err);
    return NextResponse.json({ ok: false, message: 'load-note 실패' });
  }
}
