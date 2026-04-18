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

    if (!existing || existing.user === user || existing.stale) {
      const lock = await writeLock(site, equipment, user);
      return Response.json({
        ok: true,
        acquired: true,
        takenOver: !!existing?.stale && existing.user !== user,
        lock,
      });
    }

    return Response.json({
      ok: true,
      acquired: false,
      message: '다른 사용자가 수정 중입니다.',
      lock: existing,
    });
  } catch (err) {
    console.error('[acquire-lock] error', err);
    return Response.json(
      { ok: false, acquired: false, message: '락 획득 실패' },
      { status: 500 }
    );
  }
}
