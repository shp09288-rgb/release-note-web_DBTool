import { NextResponse } from 'next/server';
import { parseUpdateListHtml } from '@/lib/parsers/update-list-html';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { html, fileName } = await req.json();
    const document = parseUpdateListHtml(String(html ?? ''));

    // 같은 사이트·버전(XEA/XES) 조합이 이미 있는지 알려준다. 조용히 중복 생성하지 않는다.
    //
    // 문서에는 설비 번호도, 배포일도 들어있지 않다 (ParsedHeader에 날짜 필드가 없고,
    // equipment는 항상 null — 사람이 미리보기에서 채운다). 실제 저장 식별자는
    // (site, equipment, deployed_on, xea_to_build, xes_to_build) 다섯 개지만
    // 이 시점에는 그중 site·xea_to_build·xes_to_build 세 개만 알 수 있다.
    // 그래서 이 검사는 "확정된 중복"이 아니라 "같은 버전 조합이 이미 있다는 참고 경고"일 뿐이다.
    // 빌드 번호는 제품군 단위로 공유되므로, 같은 사이트의 서로 다른 설비가 같은
    // XEA/XES 빌드에 도달하는 것은 흔한 일이다 — equipment까지 맞춰보지 않으면
    // 실제로는 다른 설비인데 "이미 등록됨"으로 잘못 경고하게 된다.
    //
    // xeaToBuild 또는 xesToBuild를 파싱하지 못한 문서(둘 중 하나라도 null)는
    // 의도적으로 검사를 건너뛴다 — 실수가 아니다. 버전을 좁혀 맞출 수 없는데
    // 억지로 매칭하면 무관한 행을 "중복"으로 잘못 짚을 수 있기 때문이다.
    let duplicate: { id: string; deployedOn: string | null; message: string } | null = null;
    if (
      document.header.site &&
      document.header.xeaToBuild != null &&
      document.header.xesToBuild != null
    ) {
      const supabase = createServerClient();
      const { data } = await supabase
        .from('deployments')
        .select('id, deployed_on')
        .eq('site', document.header.site)
        .eq('xea_to_build', document.header.xeaToBuild)
        .eq('xes_to_build', document.header.xesToBuild)
        .limit(1);
      const row = (data ?? [])[0] ?? null;
      duplicate = row
        ? {
            id: row.id,
            deployedOn: row.deployed_on,
            message:
              '동일 사이트에서 같은 XEA/XES 버전 조합의 배포 기록이 이미 있습니다. ' +
              '설비 번호와 배포일은 아직 확인되지 않았으므로 실제로 다른 설비일 수 있습니다 — 참고용 경고입니다.',
          }
        : null;
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
