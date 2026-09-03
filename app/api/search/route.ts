import { NextResponse } from 'next/server';
import { searchItems } from '@/lib/queries/deployments';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';

  try {
    const hits = await searchItems(q);
    return NextResponse.json({ ok: true, hits });
  } catch (err) {
    console.error('[search]', err);
    return NextResponse.json({ ok: false, hits: [], message: '검색 실패' }, { status: 500 });
  }
}
