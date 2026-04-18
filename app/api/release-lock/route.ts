import { getLockMeta, removeLock } from '@/lib/lock-utils';

export async function POST(req: Request) {
  try {
    const { site, equipment, user } = await req.json();

    if (!site || !equipment || !user) {
      return Response.json(
        {
          ok: false,
          released: false,
          message: 'site, equipment, user 필요',
        },
        { status: 400 }
      );
    }

    const existing = await getLockMeta(site, equipment);

    console.log('[release-lock]', {
      site,
      equipment,
      user,
      existing,
    });

    if (!existing) {
      return Response.json({
        ok: true,
        released: true,
        message: 'lock 없음',
      });
    }

    if (existing.user !== user && !existing.stale) {
      return Response.json({
        ok: true,
        released: false,
        message: '본인 락이 아닙니다.',
        existing,
      });
    }

    await removeLock(site, equipment);

    return Response.json({
      ok: true,
      released: true,
      message: 'lock 삭제 완료',
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      {
        ok: false,
        released: false,
        message: '락 해제 실패',
      },
      { status: 500 }
    );
  }
}