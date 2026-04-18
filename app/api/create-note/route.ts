import { createServerClient } from '@/lib/supabase';

function normalizeSite(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '_').toUpperCase();
}

function normalizeEquipment(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const site = normalizeSite(body.site);
    const equipment = normalizeEquipment(body.equipment);

    if (!site || !equipment) {
      return Response.json(
        { ok: false, message: 'site와 equipment를 모두 입력해야 합니다.' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // 중복 확인
    const { data: existing } = await supabase
      .from('notes')
      .select('id')
      .eq('site', site)
      .eq('equipment', equipment)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { ok: false, message: '이미 같은 Site / Equipment 카드가 존재합니다.' },
        { status: 409 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const { error } = await supabase.from('notes').insert({
      site,
      equipment,
      date: today,
      xea_before: '',
      xea_after: '',
      xes_before: '',
      xes_after: '',
      cim_ver: '',
    });

    if (error) throw error;

    return Response.json({
      ok: true,
      message: '새 카드가 생성되었습니다.',
      file: `${site}_${equipment}.json`,
      site,
      equipment,
    });
  } catch (err) {
    console.error('[create-note]', err);
    return Response.json(
      { ok: false, message: '새 카드 생성 실패' },
      { status: 500 }
    );
  }
}
