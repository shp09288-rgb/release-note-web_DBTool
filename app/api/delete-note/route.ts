import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

// fileName(e.g. "SDC_A6_EQ01.json") → { site: "SDC_A6", equipment: "EQ01" }
function parseSiteAndEquipment(fileName: string) {
  const name = fileName.replace(/\.json$/i, '');
  const parts = name.split('_');
  const equipment = parts.pop() ?? '';
  const site = parts.join('_');
  return { site, equipment };
}

export async function POST(req: Request) {
  try {
    const { fileName } = await req.json();

    if (!fileName) {
      return NextResponse.json({ ok: false, message: 'fileName 없음' });
    }

    const { site, equipment } = parseSiteAndEquipment(fileName);

    const supabase = createServerClient();

    const { data: note } = await supabase
      .from('notes')
      .select('id')
      .eq('site', site)
      .eq('equipment', equipment)
      .maybeSingle();

    if (!note) {
      return NextResponse.json({ ok: false, message: '카드 없음' });
    }

    // notes 삭제 → ON DELETE CASCADE로 자식 테이블 자동 삭제
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', note.id);

    if (error) throw error;

    // edit_locks는 FK 없으므로 명시적 삭제
    await supabase
      .from('edit_locks')
      .delete()
      .eq('site', site)
      .eq('equipment', equipment);

    return NextResponse.json({ ok: true, message: '삭제 완료' });
  } catch (err) {
    console.error('[delete-note]', err);
    return NextResponse.json({ ok: false, message: '서버 에러' });
  }
}
