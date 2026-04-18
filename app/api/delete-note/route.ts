import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyDashboardPassword } from '@/lib/dashboard-password';
import { normalizeEquipment, normalizeSite } from '@/lib/note-utils';

function parseLegacyFileName(fileName: string) {
  const old = String(fileName || '').replace(/\.json$/i, '');
  const parts = old.split('_');
  const equipment = normalizeEquipment(parts.pop() || '');
  const site = normalizeSite(parts.join('_'));
  return { site, equipment };
}

export async function POST(req: Request) {
  try {
    const { noteId, site: rawSite, equipment: rawEquipment, fileName, password } = await req.json();

    const verified = await verifyDashboardPassword(String(password || ''));
    if (!verified) {
      return NextResponse.json({ ok: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const supabase = createServerClient();

    if (noteId) {
      const { error: deleteLockError } = await supabase
        .from('edit_locks')
        .delete()
        .eq('site', normalizeSite(rawSite || ''))
        .eq('equipment', normalizeEquipment(rawEquipment || ''));
      if (deleteLockError) throw deleteLockError;

      const { error: deleteNoteError } = await supabase.from('notes').delete().eq('id', noteId);
      if (deleteNoteError) throw deleteNoteError;
      return NextResponse.json({ ok: true, message: '삭제 완료' });
    }

    let site = normalizeSite(rawSite || '');
    let equipment = normalizeEquipment(rawEquipment || '');
    if ((!site || !equipment) && fileName) {
      const parsed = parseLegacyFileName(fileName);
      site = parsed.site;
      equipment = parsed.equipment;
    }

    if (!site || !equipment) {
      return NextResponse.json({ ok: false, message: '삭제 대상 식별값이 없습니다.' }, { status: 400 });
    }

    const { error: deleteLockError } = await supabase
      .from('edit_locks')
      .delete()
      .eq('site', site)
      .eq('equipment', equipment);
    if (deleteLockError) throw deleteLockError;

    const { error: deleteNoteError } = await supabase
      .from('notes')
      .delete()
      .eq('site', site)
      .eq('equipment', equipment);
    if (deleteNoteError) throw deleteNoteError;

    return NextResponse.json({ ok: true, message: '삭제 완료' });
  } catch (err) {
    console.error('[delete-note]', err);
    return NextResponse.json({ ok: false, message: '서버 에러' }, { status: 500 });
  }
}
