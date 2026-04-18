import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { normalizeEquipment, normalizeSite } from '@/lib/note-utils';

type DetailType = 'xea' | 'xes' | 'test';

export async function POST(req: Request) {
  try {
    const { site, equipment } = await req.json();

    const safeSite = normalizeSite(site);
    const safeEquipment = normalizeEquipment(equipment);
    const supabase = createServerClient();

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select('id, site, equipment, date, xea_before, xea_after, xes_before, xes_after, cim_ver')
      .eq('site', safeSite)
      .eq('equipment', safeEquipment)
      .maybeSingle();

    if (noteError) throw noteError;

    if (!note) {
      return NextResponse.json({
        ok: true,
        data: {
          site: safeSite,
          equipment: safeEquipment,
          date: '',
          xeaBefore: '',
          xeaAfter: '',
          xesBefore: '',
          xesAfter: '',
          cimVer: '',
          overview: [''],
          xeaDetails: [],
          xesDetails: [],
          testVersions: [],
          notes: [],
          history: [],
        },
      });
    }

    const [
      { data: overviewRows, error: overviewError },
      { data: detailRows, error: detailError },
      { data: noteItems, error: noteItemsError },
      { data: historyRows, error: historyError },
    ] = await Promise.all([
      supabase
        .from('overview_items')
        .select('text, sort_order')
        .eq('note_id', note.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('detail_rows')
        .select('type, ref, category, title, desc, sort_order')
        .eq('note_id', note.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('note_items')
        .select('icon, text, sort_order')
        .eq('note_id', note.id)
        .order('sort_order', { ascending: true }),
      supabase
        .from('history_rows')
        .select('date, xea, xes, cim, summary, sort_order')
        .eq('note_id', note.id)
        .order('sort_order', { ascending: true }),
    ]);

    if (overviewError) throw overviewError;
    if (detailError) throw detailError;
    if (noteItemsError) throw noteItemsError;
    if (historyError) throw historyError;

    const grouped = { xea: [] as any[], xes: [] as any[], test: [] as any[] };
    for (const row of detailRows || []) {
      const normalized = {
        ref: row.ref || '',
        category: row.category || '',
        title: row.title || '',
        desc: (row as any).desc || '',
      };
      const type = (row.type || 'xea') as DetailType;
      grouped[type].push(normalized);
    }

    return NextResponse.json({
      ok: true,
      data: {
        site: note.site,
        equipment: note.equipment,
        date: note.date || '',
        xeaBefore: note.xea_before || '',
        xeaAfter: note.xea_after || '',
        xesBefore: note.xes_before || '',
        xesAfter: note.xes_after || '',
        cimVer: note.cim_ver || '',
        overview:
          Array.isArray(overviewRows) && overviewRows.length > 0
            ? overviewRows.map((row) => row.text || '')
            : [''],
        xeaDetails: grouped.xea,
        xesDetails: grouped.xes,
        testVersions: grouped.test,
        notes: (noteItems || []).map((row) => ({
          icon: row.icon === 'i' ? 'i' : '!',
          text: row.text || '',
        })),
        history: (historyRows || []).map((row) => ({
          date: row.date || '',
          xea: row.xea || '',
          xes: row.xes || '',
          cim: row.cim || '',
          summary: row.summary || '',
        })),
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ ok: false, message: 'load-note 실패' }, { status: 500 });
  }
}
