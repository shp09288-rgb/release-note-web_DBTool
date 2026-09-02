import { NextResponse } from 'next/server';
import { verifyDashboardPassword } from '@/lib/dashboard-password';
import { insertDeployment } from '@/lib/queries/deployments';
import type { DeploymentDraft } from '@/lib/queries/types';

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

    const deploymentId = await insertDeployment({ ...draft, sourceKind: 'html_upload' });
    return NextResponse.json({ ok: true, deploymentId });
  } catch (err) {
    console.error('[upload/commit]', err);
    return NextResponse.json({ ok: false, message: '저장 실패' }, { status: 500 });
  }
}
