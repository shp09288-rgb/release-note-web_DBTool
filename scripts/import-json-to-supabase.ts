/**
 * JSON → Supabase 마이그레이션 스크립트
 *
 * 사용법:
 *   npx tsx scripts/import-json-to-supabase.ts
 *
 * 전제 조건:
 *   1. .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정
 *   2. supabase/schema.sql을 Supabase SQL Editor에서 실행 완료
 *   3. data/*.json 파일이 존재
 */

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 설정해주세요.'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

function normalizeSite(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '_').toUpperCase();
}

function normalizeEquipment(value: string) {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
}

function parseSiteFromFileName(fileName: string) {
  const name = fileName.replace(/\.json$/i, '');
  const parts = name.split('_');
  const equipment = parts.pop() ?? '';
  const site = parts.join('_');
  return { site, equipment };
}

interface DetailRow { ref?: string; category?: string; title?: string; desc?: string }
interface NoteItem { icon?: string; text?: string }
interface HistoryRow { date?: string; xea?: string; xes?: string; cim?: string; summary?: string }

async function importFile(filePath: string, fileName: string) {
  let json: Record<string, unknown>;

  try {
    const raw = await readFile(filePath, 'utf-8');
    json = JSON.parse(raw) as Record<string, unknown>;
  } catch (e) {
    console.warn(`  ⚠ 파싱 실패, 건너뜀: ${fileName}`, e);
    return;
  }

  const { site: fallbackSite, equipment: fallbackEquipment } =
    parseSiteFromFileName(fileName);

  const site = normalizeSite((json.site as string) || fallbackSite);
  const equipment = normalizeEquipment(
    (json.equipment as string) || fallbackEquipment
  );

  console.log(`\n→ ${site} / ${equipment}`);

  const now = new Date().toISOString();

  // 1) notes upsert
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .upsert(
      {
        site,
        equipment,
        date: (json.date as string) ?? '',
        xea_before: (json.xeaBefore as string) ?? '',
        xea_after: (json.xeaAfter as string) ?? '',
        xes_before: (json.xesBefore as string) ?? '',
        xes_after: (json.xesAfter as string) ?? '',
        cim_ver: (json.cimVer as string) ?? '',
        updated_by: (json.lastModifiedBy as string) ?? '',
        updated_at: now,
      },
      { onConflict: 'site,equipment' }
    )
    .select('id')
    .single();

  if (noteError || !note) {
    console.error(`  ❌ notes upsert 실패:`, noteError?.message);
    return;
  }

  const noteId = note.id as string;

  // 2) 기존 자식 행 삭제
  await Promise.all([
    supabase.from('overview_items').delete().eq('note_id', noteId),
    supabase.from('detail_rows').delete().eq('note_id', noteId),
    supabase.from('note_items').delete().eq('note_id', noteId),
    supabase.from('history_rows').delete().eq('note_id', noteId),
  ]);

  // 3) overview_items
  const overview = Array.isArray(json.overview)
    ? (json.overview as string[]).filter((s) => typeof s === 'string')
    : [];
  if (overview.length > 0) {
    const { error } = await supabase.from('overview_items').insert(
      overview.map((text, i) => ({ note_id: noteId, sort_order: i, text }))
    );
    if (error) console.warn(`  ⚠ overview_items:`, error.message);
    else console.log(`  ✓ overview: ${overview.length}건`);
  }

  // 4) detail_rows (xea / xes / test)
  const xeaDetails: DetailRow[] = Array.isArray(json.xeaDetails)
    ? (json.xeaDetails as DetailRow[]) : [];
  const xesDetails: DetailRow[] = Array.isArray(json.xesDetails)
    ? (json.xesDetails as DetailRow[]) : [];
  const testVersions: DetailRow[] = Array.isArray(json.testVersions)
    ? (json.testVersions as DetailRow[]) : [];

  const allDetails = [
    ...xeaDetails.map((d, i) => ({
      note_id: noteId, type: 'xea', sort_order: i,
      ref: d.ref ?? '', category: d.category ?? '',
      title: d.title ?? '', desc: d.desc ?? '',
    })),
    ...xesDetails.map((d, i) => ({
      note_id: noteId, type: 'xes', sort_order: i,
      ref: d.ref ?? '', category: d.category ?? '',
      title: d.title ?? '', desc: d.desc ?? '',
    })),
    ...testVersions.map((d, i) => ({
      note_id: noteId, type: 'test', sort_order: i,
      ref: d.ref ?? '', category: d.category ?? '',
      title: d.title ?? '', desc: d.desc ?? '',
    })),
  ];
  if (allDetails.length > 0) {
    const { error } = await supabase.from('detail_rows').insert(allDetails);
    if (error) console.warn(`  ⚠ detail_rows:`, error.message);
    else console.log(`  ✓ detail_rows: ${allDetails.length}건`);
  }

  // 5) note_items
  const noteItems: NoteItem[] = Array.isArray(json.notes)
    ? (json.notes as NoteItem[]) : [];
  if (noteItems.length > 0) {
    const { error } = await supabase.from('note_items').insert(
      noteItems.map((n, i) => ({
        note_id: noteId, sort_order: i,
        icon: n.icon ?? '!', text: n.text ?? '',
      }))
    );
    if (error) console.warn(`  ⚠ note_items:`, error.message);
    else console.log(`  ✓ note_items: ${noteItems.length}건`);
  }

  // 6) history_rows
  const history: HistoryRow[] = Array.isArray(json.history)
    ? (json.history as HistoryRow[]) : [];
  if (history.length > 0) {
    const { error } = await supabase.from('history_rows').insert(
      history.map((h, i) => ({
        note_id: noteId, sort_order: i,
        date: h.date ?? '', xea: h.xea ?? '', xes: h.xes ?? '',
        cim: h.cim ?? '', summary: h.summary ?? '',
      }))
    );
    if (error) console.warn(`  ⚠ history_rows:`, error.message);
    else console.log(`  ✓ history_rows: ${history.length}건`);
  }

  console.log(`  ✅ 완료 (noteId: ${noteId})`);
}

async function main() {
  const dataDir = path.join(process.cwd(), 'data');

  let files: string[];
  try {
    const all = await readdir(dataDir);
    files = all.filter((f) => f.endsWith('.json'));
  } catch {
    console.error(`❌ data 폴더 없음: ${dataDir}`);
    process.exit(1);
  }

  console.log(`\n📂 data/*.json ${files.length}개 파일 임포트 시작\n`);

  for (const file of files) {
    await importFile(path.join(dataDir, file), file);
  }

  console.log('\n🎉 전체 임포트 완료!\n');
}

main().catch((err) => {
  console.error('❌ 임포트 중 오류:', err);
  process.exit(1);
});
