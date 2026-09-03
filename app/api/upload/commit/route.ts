import { NextResponse } from 'next/server';
import { verifyDashboardPassword } from '@/lib/dashboard-password';
import { insertDeployment } from '@/lib/queries/deployments';
import { parseBuild } from '@/lib/version';
import type { DeploymentDraft } from '@/lib/queries/types';

const DATE_FORMAT_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req: Request) {
  try {
    const { password, draft } = (await req.json()) as {
      password?: string;
      draft?: DeploymentDraft;
    };

    if (!(await verifyDashboardPassword(String(password ?? '')))) {
      return NextResponse.json(
        { ok: false, message: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    if (!draft?.site || !draft?.equipment) {
      return NextResponse.json(
        { ok: false, message: '사이트와 설비를 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!draft?.deployedOn || !DATE_FORMAT_RE.test(draft.deployedOn)) {
      return NextResponse.json(
        { ok: false, message: '배포일을 YYYY-MM-DD 형식으로 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(draft.items) || !Array.isArray(draft.alarms)) {
      return NextResponse.json(
        { ok: false, message: 'items/alarms 형식이 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // *_raw 와 *_build 는 같은 값의 두 표현이다. 사람이 raw 를 고쳐도
    // build 가 따라오도록, 클라이언트가 보낸 build 는 무시하고 여기서 다시 계산한다.
    const xeaFrom = parseBuild(draft.xeaFromRaw ?? '');
    const xeaTo = parseBuild(draft.xeaToRaw ?? '');
    const xesFrom = parseBuild(draft.xesFromRaw ?? '');
    const xesTo = parseBuild(draft.xesToRaw ?? '');

    const recomputedDraft: DeploymentDraft = {
      ...draft,
      xeaFromBuild: xeaFrom.build,
      xeaToBuild: xeaTo.build,
      xesFromBuild: xesFrom.build,
      xesToBuild: xesTo.build,
    };

    const deploymentId = await insertDeployment({ ...recomputedDraft, sourceKind: 'html_upload' });
    return NextResponse.json({ ok: true, deploymentId });
  } catch (err) {
    console.error('[upload/commit]', err);
    return NextResponse.json({ ok: false, message: '저장 실패' }, { status: 500 });
  }
}
