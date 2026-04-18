import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeSupabaseUrl(raw: string): string {
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) {
    if (!value.includes('.')) value = `https://${value}.supabase.co`;
    else value = `https://${value}`;
  }
  if (/^https?:\/\/[a-z0-9-]+$/i.test(value)) {
    value = `${value}.supabase.co`;
  }
  return value.replace(/\/$/, '');
}

function createServerClient() {
  return createClient(
    normalizeSupabaseUrl(readEnv('NEXT_PUBLIC_SUPABASE_URL')),
    readEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

function normalizeSite(value: string) {
  return String(value || '').trim();
}

function normalizeEquipment(value: string) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function siteCandidates(value: string) {
  const base = normalizeSite(value);
  return Array.from(
    new Set([
      base,
      base.replace(/_/g, ' '),
      base.replace(/\s+/g, '_'),
      base.replace(/_/g, ' ').toUpperCase(),
      base.replace(/\s+/g, '_').toUpperCase(),
    ].filter(Boolean))
  );
}

function emptyData(site: string, equipment: string) {
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
    xeaDetails: [],
    xesDetails: [],
    testVersions: [],
    notes: [],
    history: [],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const site = normalizeSite(body.site);
    const equipment = normalizeEquipment(body.equipment);

    if (!site || !equipment) {
      return NextResponse.json({ ok: false, message: 'site/equipment가 필요합니다.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const candidates = siteCandidates(site);

    const { data: notes, error: noteError } = await supabase
      .from('notes')
      .select('id, site, equipment, date, xea_before, xea_after, xes_before, xes_after, cim_ver, updated_at')
      .in('site', candidates)
      .eq('equipment', equipment)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (noteError) {
      console.error('[load-note] notes query failed', noteError);
      return NextResponse.json({ ok: false, message: 'load-note 실패' }, { status: 500 });
    }

    const note = notes?.[0];
    if (!note) {
      return NextResponse.json({ ok: true, data: emptyData(site, equipment) });
    }

    const noteId = note.id as string;

    const [overviewRes, detailsRes, notesRes, historyRes] = await Promise.all([
      supabase
        .from('overview_items')
        .select('text, sort_order')
        .eq('note_id', noteId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('detail_rows')
        .select('type, ref, category, title, desc, sort_order')
        .eq('note_id', noteId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('note_items')
        .select('icon, text, sort_order')
        .eq('note_id', noteId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('history_rows')
        .select('date, xea, xes, cim, summary, sort_order')
        .eq('note_id', noteId)
        .order('sort_order', { ascending: true }),
    ]);

    const childErrors = [overviewRes.error, detailsRes.error, notesRes.error, historyRes.error].filter(Boolean);
    if (childErrors.length > 0) {
      console.error('[load-note] child query failed', childErrors);
      return NextResponse.json({ ok: false, message: 'load-note 실패' }, { status: 500 });
    }

    const detailRows = detailsRes.data ?? [];

    return NextResponse.json({
      ok: true,
      data: {
        site: note.site,
        equipment: note.equipment,
        date: note.date ?? '',
        xeaBefore: note.xea_before ?? '',
        xeaAfter: note.xea_after ?? '',
        xesBefore: note.xes_before ?? '',
        xesAfter: note.xes_after ?? '',
        cimVer: note.cim_ver ?? '',
        overview:
          (overviewRes.data ?? []).map((row) => row.text ?? '').filter((text) => text !== '') || [''],
        xeaDetails: detailRows
          .filter((row) => row.type === 'xea')
          .map((row) => ({
            ref: row.ref ?? '',
            category: row.category ?? 'Improvement',
            title: row.title ?? '',
            desc: row.desc ?? '',
          })),
        xesDetails: detailRows
          .filter((row) => row.type === 'xes')
          .map((row) => ({
            ref: row.ref ?? '',
            category: row.category ?? 'Improvement',
            title: row.title ?? '',
            desc: row.desc ?? '',
          })),
        testVersions: detailRows
          .filter((row) => row.type === 'test')
          .map((row) => ({
            ref: row.ref ?? '',
            category: row.category ?? 'Improvement',
            title: row.title ?? '',
            desc: row.desc ?? '',
          })),
        notes: (notesRes.data ?? []).map((row) => ({
          icon: row.icon === 'i' ? 'i' : '!',
          text: row.text ?? '',
        })),
        history: (historyRes.data ?? []).map((row) => ({
          date: row.date ?? '',
          xea: row.xea ?? '',
          xes: row.xes ?? '',
          cim: row.cim ?? '',
          summary: row.summary ?? '',
        })),
      },
    });
  } catch (err) {
    console.error('[load-note] fatal', err);
    return NextResponse.json({ ok: false, message: 'load-note 실패' }, { status: 500 });
  }
}
