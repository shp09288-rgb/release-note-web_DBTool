import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const { fileName } = await req.json();

    if (!fileName) {
      return NextResponse.json({
        ok: false,
        message: 'fileName 없음',
      });
    }

    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, fileName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        ok: false,
        message: '파일 없음',
      });
    }

    // 1. JSON 삭제
    fs.unlinkSync(filePath);

    // 2. lock 삭제
    const lockDir = path.join(dataDir, '_locks');
    const lockName = fileName.replace(/\.json$/i, '.lock');
    const lockPath = path.join(lockDir, lockName);

    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }

    return NextResponse.json({
      ok: true,
      message: '삭제 완료',
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      ok: false,
      message: '서버 에러',
    });
  }
}