import { NextResponse } from 'next/server';
import {
  updateDashboardPassword,
  verifyDashboardPassword,
} from '@/lib/dashboard-password';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      );
    }

    const verified = await verifyDashboardPassword(currentPassword);
    if (!verified) {
      return NextResponse.json(
        { ok: false, message: '현재 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    await updateDashboardPassword(newPassword);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('dashboard-password/change error:', error);
    return NextResponse.json(
      { ok: false, message: '비밀번호 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}