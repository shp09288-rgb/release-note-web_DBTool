import { getLockMeta, writeLock } from '@/lib/lock-utils';

export async function POST(req: Request) {
  try {
    const { site, equipment, user } = await req.json();

    if (!site || !equipment || !user) {
      return Response.json(
        { ok: false, message: 'site, equipment, user 필요' },
        { status: 400 }
      );
    }

    const existing = await getLockMeta(site, equipment);

    // 락 없음 -> 획득
    if (!existing) {
      const lock = await writeLock(site, equipment, user);
      return Response.json({
        ok: true,
        acquired: true,
        lock,
      });
    }

    // 같은 사용자 -> 갱신
    if (existing.user === user) {
      const lock = await writeLock(site, equipment, user);
      return Response.json({
        ok: true,
        acquired: true,
        lock,
      });
    }

    // stale -> takeover 허용
    if (existing.stale) {
      const lock = await writeLock(site, equipment, user);
      return Response.json({
        ok: true,
        acquired: true,
        lock,
        takenOver: true,
      });
    }

    // 다른 사용자가 점유 중
    return Response.json({
      ok: true,
      acquired: false,
      lock: existing,
      message: '다른 사용자가 수정 중입니다.',
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { ok: false, message: '락 획득 실패' },
      { status: 500 }
    );
  }
}