/**
 * One-off integration check for normalized note save flow.
 * Run: npx tsx scripts/verify-note-save-flow.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

function normalizeSite(value) {
  return String(value || '').trim().replace(/\s+/g, '_').toUpperCase();
}

function normalizeEquipment(value) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function siteLookupCandidates(normalizedSite) {
  const base = normalizedSite;
  return Array.from(
    new Set(
      [
        base,
        base.replace(/_/g, ' '),
        base.replace(/\s+/g, '_'),
        base.replace(/_/g, ' ').toLowerCase(),
        base.toLowerCase(),
      ].filter(Boolean)
    )
  );
}

function matchesNormalizedNoteKey(row, normalizedSite, normalizedEquipment) {
  return (
    normalizeSite(row.site) === normalizedSite &&
    normalizeEquipment(row.equipment) === normalizedEquipment
  );
}

function pickExistingNoteByNormalizedKey(rows, normalizedSite, normalizedEquipment) {
  const matches = rows.filter((row) =>
    matchesNormalizedNoteKey(row, normalizedSite, normalizedEquipment)
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  })[0];
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function createServerClient() {
  let url = readEnv('NEXT_PUBLIC_SUPABASE_URL').trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}.supabase.co`;
  return createClient(url.replace(/\/$/, ''), readEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const supabase = createServerClient();
const suffix = Date.now();
const normalizedSite = normalizeSite(`QA_SAVE_${suffix}`);
const normalizedEquipment = normalizeEquipment(`EQ ${suffix}`);
const legacySite = normalizedSite.replace(/_/g, ' ');

let legacyNoteId = null;
let newNoteId = null;

async function cleanup() {
  const ids = [legacyNoteId, newNoteId].filter(Boolean);
  for (const id of ids) {
    await supabase.from('overview_items').delete().eq('note_id', id);
    await supabase.from('detail_rows').delete().eq('note_id', id);
    await supabase.from('note_items').delete().eq('note_id', id);
    await supabase.from('history_rows').delete().eq('note_id', id);
    await supabase.from('notes').delete().eq('id', id);
  }
}

async function selectExisting(site, equipment) {
  const { data, error } = await supabase
    .from('notes')
    .select('id, site, equipment, updated_at')
    .in('site', siteLookupCandidates(site));
  if (error) throw error;
  return pickExistingNoteByNormalizedKey(data ?? [], site, equipment);
}

async function main() {
  console.log('=== verify-note-save-flow ===');

  // Case A: legacy raw site + save with normalized site (UPDATE path, no 23505)
  {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        site: legacySite,
        equipment: normalizedEquipment,
        date: '2026-01-01',
        updated_by: 'verify-script',
      })
      .select('id, site, equipment')
      .single();
    if (error) throw Object.assign(new Error('legacy insert failed'), error);
    legacyNoteId = data.id;
    console.log('legacy row:', data.site, '/', data.equipment);

    const existing = await selectExisting(normalizedSite, normalizedEquipment);
    if (!existing || existing.id !== legacyNoteId) {
      throw new Error('normalized lookup failed to find legacy row');
    }

    const payload = {
      site: normalizedSite,
      equipment: normalizedEquipment,
      date: '2026-01-02',
      xea_before: '',
      xea_after: '1.0',
      xes_before: '',
      xes_after: '',
      cim_ver: '',
      updated_by: 'verify-script',
    };

    const { error: updateError } = await supabase.from('notes').update(payload).eq('id', existing.id);
    if (updateError) throw Object.assign(new Error('normalized update failed'), updateError);

    const { data: afterUpdate } = await supabase
      .from('notes')
      .select('id, site, equipment')
      .eq('id', legacyNoteId)
      .single();

    console.log('after update:', afterUpdate?.site, '/', afterUpdate?.equipment);
    if (afterUpdate?.site !== normalizedSite) {
      throw new Error('site was not normalized on update');
    }
    console.log('PASS: legacy raw -> normalized UPDATE (no 23505)');
  }

  // Case B: brand new note INSERT path
  {
    const newSite = normalizeSite(`QA_NEW_${suffix}`);
    const newEquip = normalizeEquipment(`NEW_${suffix}`);

    const existing = await selectExisting(newSite, newEquip);
    if (existing) throw new Error('expected no existing row for new note');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        site: newSite,
        equipment: newEquip,
        date: '2026-01-03',
        updated_by: 'verify-script',
      })
      .select('id')
      .single();
    if (error) throw Object.assign(new Error('new insert failed'), error);
    newNoteId = data.id;
    console.log('PASS: new note INSERT');
  }

  // Case C: existing normalized note UPDATE path
  {
    const existing = await selectExisting(normalizedSite, normalizedEquipment);
    if (!existing) throw new Error('expected existing legacy note');

    const { error } = await supabase
      .from('notes')
      .update({ date: '2026-01-04', updated_by: 'verify-script-update' })
      .eq('id', existing.id);
    if (error) throw Object.assign(new Error('existing update failed'), error);
    console.log('PASS: existing note UPDATE');
  }

  console.log('ALL CHECKS PASSED');
}

main()
  .catch((err) => {
    console.error('FAILED:', err?.code || '', err?.message || err);
    if (err?.details) console.error('details:', err.details);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    console.log('cleanup done');
  });
