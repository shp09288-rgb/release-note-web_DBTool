import { NextResponse } from 'next/server';
import { verifyDashboardPassword } from '@/lib/dashboard-password';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const ok = await verifyDashboardPassword(String(password || ''));
    return NextResponse.json({ ok: true, verified: ok });
  } catch (err) {
    console.error('[dashboard-password/verify]', err);
    return NextResponse.json({ ok: false, verified: false, message: '비밀번호 확인 실패' }, { status: 500 });
  }
}
