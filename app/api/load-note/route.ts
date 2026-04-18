import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

function normalizeSite(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '_');
}

function normalizeEquipment(value: string) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '');
}

export async function POST(req: Request) {
  try {
    const { site, equipment } = await req.json();

    const safeSite = normalizeSite(site);
    const safeEquipment = normalizeEquipment(equipment);

    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${safeSite}_${safeEquipment}.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({
        ok: true,
        data: {
          site,
          equipment,
          date: '',
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
        },
      });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    return NextResponse.json({
      ok: true,
      data,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      ok: false,
      message: 'load-note 실패',
    });
  }
}