require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function readEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value.trim();
}

function normalizeUrl(raw) {
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) {
    if (!value.includes('.')) value = `https://${value}.supabase.co`;
    else value = `https://${value}`;
  }
  if (/^https?:\/\/[a-z0-9-]+$/i.test(value)) value = `${value}.supabase.co`;
  return value.replace(/\/$/, '');
}

function normalizeText(v) {
  return String(v ?? '').trim();
}

function normalizeSite(v) {
  return normalizeText(v).replace(/\s+/g, ' ');
}

function normalizeEquipment(v) {
  return normalizeText(v).replace(/\s+/g, ' ').toUpperCase();
}

function toArray(v) {
  return Array.isArray(v) ? v : [];
}

function getInputFiles(args) {
  if (!args.length) throw new Error('Usage: node import_release_notes.cjs <json-file-or-folder> [more-files]');
  const out = [];
  for (const arg of args) {
    const p = path.resolve(arg);
    if (!fs.existsSync(p)) throw new Error(`Path not found: ${p}`);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(p)) {
        if (name.toLowerCase().endsWith('.json')) out.push(path.join(p, name));
      }
    } else if (p.toLowerCase().endsWith('.json')) {
      out.push(p);
    }
  }
  return [...new Set(out)].sort();
}

async function upsertNote(supabase, filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const site = normalizeSite(raw.site || raw.siteName || '');
  const equipment = normalizeEquipment(raw.equipment || raw.equipmentId || raw.eqId || '');

  if (!site || !equipment) {
    throw new Error(`site/equipment missing in ${path.basename(filePath)}`);
  }

  const notePayload = {
    site,
    equipment,
    date: normalizeText(raw.date),
    xea_before: normalizeText(raw.xeaBefore),
    xea_after: normalizeText(raw.xeaAfter),
    xes_before: normalizeText(raw.xesBefore),
    xes_after: normalizeText(raw.xesAfter),
    cim_ver: normalizeText(raw.cimVer),
    updated_by: 'import-script',
  };

  let noteId;
  const existing = await supabase
    .from('notes')
    .select('id')
    .eq('site', site)
    .eq('equipment', equipment)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data?.id) {
    noteId = existing.data.id;
    const updated = await supabase.from('notes').update(notePayload).eq('id', noteId).select('id').single();
    if (updated.error) throw updated.error;
  } else {
    const inserted = await supabase.from('notes').insert(notePayload).select('id').single();
    if (inserted.error) throw inserted.error;
    noteId = inserted.data.id;
  }

  const deletes = [
    supabase.from('overview_items').delete().eq('note_id', noteId),
    supabase.from('detail_rows').delete().eq('note_id', noteId),
    supabase.from('note_items').delete().eq('note_id', noteId),
    supabase.from('history_rows').delete().eq('note_id', noteId),
  ];
  const deleteResults = await Promise.all(deletes);
  for (const r of deleteResults) if (r.error) throw r.error;

  const overviewRows = toArray(raw.overview).map((text, idx) => ({
    note_id: noteId,
    sort_order: idx,
    text: normalizeText(text),
  })).filter(r => r.text);

  const detailRows = [
    ...toArray(raw.xeaDetails).map((row, idx) => ({
      note_id: noteId, type: 'xea', sort_order: idx,
      ref: normalizeText(row.ref), category: normalizeText(row.category),
      title: normalizeText(row.title), desc: normalizeText(row.desc),
    })),
    ...toArray(raw.xesDetails).map((row, idx) => ({
      note_id: noteId, type: 'xes', sort_order: idx,
      ref: normalizeText(row.ref), category: normalizeText(row.category),
      title: normalizeText(row.title), desc: normalizeText(row.desc),
    })),
    ...toArray(raw.testVersions).map((row, idx) => ({
      note_id: noteId, type: 'test', sort_order: idx,
      ref: normalizeText(row.ref), category: normalizeText(row.category),
      title: normalizeText(row.title), desc: normalizeText(row.desc),
    })),
  ];

  const noteItems = toArray(raw.notes).map((row, idx) => ({
    note_id: noteId,
    sort_order: idx,
    icon: normalizeText(row.icon || '!') === 'i' ? 'i' : '!',
    text: normalizeText(row.text || row),
  })).filter(r => r.text);

  const historyRows = toArray(raw.history).map((row, idx) => ({
    note_id: noteId,
    sort_order: idx,
    date: normalizeText(row.date),
    xea: normalizeText(row.xea),
    xes: normalizeText(row.xes),
    cim: normalizeText(row.cim),
    summary: normalizeText(row.summary),
  }));

  if (overviewRows.length) {
    const r = await supabase.from('overview_items').insert(overviewRows);
    if (r.error) throw r.error;
  }
  if (detailRows.length) {
    const r = await supabase.from('detail_rows').insert(detailRows);
    if (r.error) throw r.error;
  }
  if (noteItems.length) {
    const r = await supabase.from('note_items').insert(noteItems);
    if (r.error) throw r.error;
  }
  if (historyRows.length) {
    const chunkSize = 200;
    for (let i = 0; i < historyRows.length; i += chunkSize) {
      const chunk = historyRows.slice(i, i + chunkSize);
      const r = await supabase.from('history_rows').insert(chunk);
      if (r.error) throw r.error;
    }
  }

  return {
    file: path.basename(filePath),
    site,
    equipment,
    historyCount: historyRows.length,
    overviewCount: overviewRows.length,
    detailCount: detailRows.length,
    noteCount: noteItems.length,
  };
}

(async function main() {
  try {
    const url = normalizeUrl(readEnv('NEXT_PUBLIC_SUPABASE_URL'));
    const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
    const files = getInputFiles(process.argv.slice(2));
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    console.log(`Import start: ${files.length} file(s)`);
    for (const file of files) {
      const result = await upsertNote(supabase, file);
      console.log(`OK  ${result.file} -> ${result.site} / ${result.equipment} (history ${result.historyCount})`);
    }
    console.log('Done');
  } catch (err) {
    console.error('IMPORT FAILED');
    console.error(err);
    process.exit(1);
  }
})();
