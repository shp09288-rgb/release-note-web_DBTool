import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { verifyDashboardPassword } from '@/lib/dashboard-password';
import { buildSyntheticFileName, normalizeEquipment, normalizeSite } from '@/lib/note-utils';

function parseLegacyFileName(fileName: string) {
  const old = String(fileName || '').replace(/\.json$/i, '');
  const parts = old.split('_');
  const equipment = normalizeEquipment(parts.pop() || '');
  const site = normalizeSite(parts.join('_'));
  return { site, equipment };
}

export async function POST(req: Request) {
  try {
    const { noteId, oldFileName, oldSite, oldEquipment, newSite, newEquipment, password } = await req.json();

    const verified = await verifyDashboardPassword(String(password || ''));
    if (!verified) {
      return NextResponse.json({ ok: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const site = normalizeSite(newSite);
    const equipment = normalizeEquipment(newEquipment);
    if (!site || !equipment) {
      return NextResponse.json({ ok: false, message: '필수 값 누락' }, { status: 400 });
    }

    const supabase = createServerClient();

    let targetId = noteId as string | undefined;
    let previousSite = normalizeSite(oldSite || '');
    let previousEquipment = normalizeEquipment(oldEquipment || '');

    if (!targetId) {
      if ((!previousSite || !previousEquipment) && oldFileName) {
        const parsed = parseLegacyFileName(oldFileName);
        previousSite = parsed.site;
        previousEquipment = parsed.equipment;
      }

      const { data: current, error: currentError } = await supabase
        .from('notes')
        .select('id, site, equipment')
        .eq('site', previousSite)
        .eq('equipment', previousEquipment)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) {
        return NextResponse.json({ ok: false, message: '기존 카드를 찾을 수 없습니다.' }, { status: 404 });
      }
      targetId = current.id;
      previousSite = current.site;
      previousEquipment = current.equipment;
    } else {
      const { data: current, error: currentError } = await supabase
        .from('notes')
        .select('site, equipment')
        .eq('id', targetId)
        .single();
      if (currentError) throw currentError;
      previousSite = current.site;
      previousEquipment = current.equipment;
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from('notes')
      .select('id')
      .eq('site', site)
      .eq('equipment', equipment)
      .neq('id', targetId)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicate) {
      return NextResponse.json({ ok: false, message: '이미 존재하는 카드입니다.' }, { status: 409 });
    }

    const { error: updateNoteError } = await supabase
      .from('notes')
      .update({ site, equipment })
      .eq('id', targetId);
    if (updateNoteError) throw updateNoteError;

    const { error: updateLockError } = await supabase
      .from('edit_locks')
      .update({ site, equipment })
      .eq('site', previousSite)
      .eq('equipment', previousEquipment);
    if (updateLockError) throw updateLockError;

    return NextResponse.json({
      ok: true,
      message: '카드 이름이 변경되었습니다.',
      file: buildSyntheticFileName(site, equipment),
      site,
      equipment,
      noteId: targetId,
    });
  } catch (err) {
    console.error('[rename-note]', err);
    return NextResponse.json({ ok: false, message: '서버 에러' }, { status: 500 });
  }
}
