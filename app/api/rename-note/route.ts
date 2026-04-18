import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

function normalizeSite(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '_').toUpperCase();
}

function normalizeEquipment(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

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
    const { oldFileName, newSite, newEquipment } = await req.json();

    const newSiteNorm = normalizeSite(newSite);
    const newEquipmentNorm = normalizeEquipment(newEquipment);

    if (!oldFileName || !newSiteNorm || !newEquipmentNorm) {
      return NextResponse.json({ ok: false, message: '필수 값 누락' });
    }

    const { site: oldSite, equipment: oldEquipment } =
      parseSiteAndEquipment(oldFileName);

    const supabase = createServerClient();

    // 기존 노트 확인
    const { data: oldNote } = await supabase
      .from('notes')
      .select('id')
      .eq('site', oldSite)
      .eq('equipment', oldEquipment)
      .maybeSingle();

    if (!oldNote) {
      return NextResponse.json({
        ok: false,
        message: `기존 카드 없음: ${oldFileName}`,
      });
    }

    const isSame = oldSite === newSiteNorm && oldEquipment === newEquipmentNorm;

    // 이름이 바뀌는 경우 충돌 확인
    if (!isSame) {
      const { data: conflict } = await supabase
        .from('notes')
        .select('id')
        .eq('site', newSiteNorm)
        .eq('equipment', newEquipmentNorm)
        .maybeSingle();

      if (conflict) {
        return NextResponse.json({
          ok: false,
          message: '이미 존재하는 카드입니다.',
        });
      }
    }

    // notes 테이블 갱신
    const { error: updateError } = await supabase
      .from('notes')
      .update({ site: newSiteNorm, equipment: newEquipmentNorm })
      .eq('id', oldNote.id);

    if (updateError) throw updateError;

    // 락도 함께 이관 (없으면 no-op)
    await supabase
      .from('edit_locks')
      .update({ site: newSiteNorm, equipment: newEquipmentNorm })
      .eq('site', oldSite)
      .eq('equipment', oldEquipment);

    return NextResponse.json({
      ok: true,
      message: isSame ? '카드 정보가 수정되었습니다.' : '카드 이름이 변경되었습니다.',
      file: `${newSiteNorm}_${newEquipmentNorm}.json`,
    });
  } catch (err) {
    console.error('[rename-note]', err);
    return NextResponse.json({ ok: false, message: '서버 에러' });
  }
}
