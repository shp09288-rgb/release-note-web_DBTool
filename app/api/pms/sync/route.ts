import { NextResponse } from 'next/server';
import { verifyDashboardPassword } from '@/lib/dashboard-password';
import { syncIssues } from '@/lib/queries/pms';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (!(await verifyDashboardPassword(String(password ?? '')))) {
      return NextResponse.json({ ok: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const result = await syncIssues();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[pms/sync]', err);
    return NextResponse.json({ ok: false, message: 'PMS 동기화 실패' }, { status: 500 });
  }
}
