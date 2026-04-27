import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { buildSyntheticFileName, normalizeEquipment, normalizeSite } from '@/lib/note-utils';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const site = normalizeSite(body?.site);
    const equipment = normalizeEquipment(body?.equipment);

    if (!site || !equipment) {
      return NextResponse.json({ ok: false, message: 'site와 equipment를 모두 입력해야 합니다.' }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: existingRows, error: existingError } = await supabase
      .from('notes')
      .select('id')
      .eq('site', site)
      .eq('equipment', equipment)
      .limit(1);

    if (existingError) throw existingError;
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return NextResponse.json({ ok: false, message: '이미 같은 Site / Equipment 카드가 존재합니다.' }, { status: 409 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('notes')
      .insert({
        site,
        equipment,
        date: today,
        xea_before: '',
        xea_after: '',
        xes_before: '',
        xes_after: '',
        cim_ver: '',
        updated_by: '',
      })
      .select('id, site, equipment')
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      message: '새 카드가 생성되었습니다.',
      file: buildSyntheticFileName(site, equipment),
      site,
      equipment,
      noteId: data.id,
    });
  } catch (err) {
    console.error('[create-note]', err);
    return NextResponse.json({ ok: false, message: '새 카드 생성 실패' }, { status: 500 });
  }
}
