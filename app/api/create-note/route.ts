import { access, mkdir, writeFile } from 'fs/promises';
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

function buildFileName(site: string, equipment: string) {
  return `${site}_${equipment}.json`;
}

function buildEmptyNote(site: string, equipment: string) {
  const today = new Date().toISOString().slice(0, 10);

  return {
    site,
    equipment,
    date: today,
    xeaBefore: '',
    xeaAfter: '',
    xesBefore: '',
    xesAfter: '',
    cimVer: '',
    overview: [''],
    xeaDetails: [],
    xesDetails: [],
    testVersions: [],
    notes: [],
    history: [],
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const site = normalizeSite(body.site);
    const equipment = normalizeEquipment(body.equipment);

    if (!site || !equipment) {
      return Response.json(
        {
          ok: false,
          message: 'site와 equipment를 모두 입력해야 합니다.',
        },
        { status: 400 }
      );
    }

    const dataDir = path.join(process.cwd(), 'data');
    await mkdir(dataDir, { recursive: true });

    const fileName = buildFileName(site, equipment);
    const filePath = path.join(dataDir, fileName);

    try {
      await access(filePath);
      return Response.json(
        {
          ok: false,
          message: '이미 같은 Site / Equipment 카드가 존재합니다.',
        },
        { status: 409 }
      );
    } catch {
      // 파일 없음 → 정상 진행
    }

    const emptyNote = buildEmptyNote(site, equipment);
    await writeFile(filePath, JSON.stringify(emptyNote, null, 2), 'utf-8');

    return Response.json({
      ok: true,
      message: '새 카드가 생성되었습니다.',
      file: fileName,
      site,
      equipment,
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        ok: false,
        message: '새 카드 생성 실패',
      },
      { status: 500 }
    );
  }
}