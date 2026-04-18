import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function normalizeSite(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
}

function normalizeEquipment(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export async function POST(req: Request) {
  try {
    const { oldFileName, newSite, newEquipment } = await req.json();

    const site = normalizeSite(newSite);
    const equipment = normalizeEquipment(newEquipment);

    if (!oldFileName || !site || !equipment) {
      return NextResponse.json({
        ok: false,
        message: '필수 값 누락',
      });
    }

    const dataDir = path.join(process.cwd(), 'data');

    const oldFile = path.join(dataDir, oldFileName);
    const newFileName = `${site}_${equipment}.json`;
    const newFile = path.join(dataDir, newFileName);

    if (!fs.existsSync(oldFile)) {
      return NextResponse.json({
        ok: false,
        message: `기존 파일 없음: ${oldFileName}`,
      });
    }

    if (fs.existsSync(newFile) && oldFileName !== newFileName) {
      return NextResponse.json({
        ok: false,
        message: '이미 존재하는 카드입니다.',
      });
    }

    // 기존 내용 읽기
    const raw = fs.readFileSync(oldFile, 'utf-8');
    const json = JSON.parse(raw);

    // 내부 site/equipment도 같이 갱신
    json.site = site;
    json.equipment = equipment;

    // 같은 이름이면 내용만 갱신
    if (oldFileName === newFileName) {
      fs.writeFileSync(oldFile, JSON.stringify(json, null, 2), 'utf-8');

      return NextResponse.json({
        ok: true,
        message: '카드 정보가 수정되었습니다.',
        file: newFileName,
      });
    }

    // 새 파일명으로 저장 후 기존 파일 삭제
    fs.writeFileSync(newFile, JSON.stringify(json, null, 2), 'utf-8');
    fs.unlinkSync(oldFile);

    // lock 파일도 이름 변경
    const lockDir = path.join(dataDir, '_locks');

    const oldLockName = oldFileName.replace(/\.json$/i, '.lock');
    const newLockName = newFileName.replace(/\.json$/i, '.lock');

    const oldLock = path.join(lockDir, oldLockName);
    const newLock = path.join(lockDir, newLockName);

    if (fs.existsSync(oldLock)) {
      fs.renameSync(oldLock, newLock);
    }

    return NextResponse.json({
      ok: true,
      message: '카드 이름이 변경되었습니다.',
      file: newFileName,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      ok: false,
      message: '서버 에러',
    });
  }
}