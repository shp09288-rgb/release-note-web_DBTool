import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const fileName = `${body.site}_${body.equipment}.json`;
    const filePath = path.join(process.cwd(), 'data', fileName);

    await writeFile(
      filePath,
      JSON.stringify(body, null, 2),
      'utf-8'
    );

    return Response.json({
      ok: true,
      message: '파일 저장 완료',
      file: fileName,
    });
  } catch (err) {
    console.error(err);

    return Response.json(
      { ok: false, message: '저장 실패' },
      { status: 500 }
    );
  }
}