import { getLockMeta } from '@/lib/lock-utils';

export async function POST(req: Request) {
  try {
    const { site, equipment } = await req.json();

    if (!site || !equipment) {
      return Response.json(
        { ok: false, message: 'site, equipment 필요' },
        { status: 400 }
      );
    }

    const lock = await getLockMeta(site, equipment);

    return Response.json({
      ok: true,
      lock,
      locked: !!lock && !lock.stale,
      stale: !!lock?.stale,
      lockedBy: lock?.user || '',
      expiresAt: lock?.expiresAt || '',
    });
  } catch (err) {
    console.error('[lock-status] error', err);
    return Response.json(
      { ok: false, message: '락 조회 실패' },
      { status: 500 }
    );
  }
}
