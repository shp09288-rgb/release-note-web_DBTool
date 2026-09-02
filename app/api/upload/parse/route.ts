import { NextResponse } from 'next/server';
import { parseUpdateListHtml } from '@/lib/parsers/update-list-html';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { html, fileName } = await req.json();
    const document = parseUpdateListHtml(String(html ?? ''));

    // 같은 설비·버전 조합이 이미 있는지 알려준다. 조용히 중복 생성하지 않는다.
    let duplicate: { id: string; deployed_on: string | null } | null = null;
    if (document.header.site && document.header.xeaToBuild != null) {
      const supabase = createServerClient();
      const { data } = await supabase
        .from('deployments')
        .select('id, deployed_on')
        .eq('site', document.header.site)
        .eq('xea_to_build', document.header.xeaToBuild)
        .limit(1);
      duplicate = (data ?? [])[0] ?? null;
    }

    return NextResponse.json({
      ok: true,
      fileName: String(fileName ?? ''),
      document,
      duplicate,
    });
  } catch (err) {
    console.error('[upload/parse]', err);
    return NextResponse.json({ ok: false, message: '파싱 실패' }, { status: 500 });
  }
}
