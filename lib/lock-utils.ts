import { createServerClient } from '@/lib/supabase';

export type LockInfo = {
  site: string;
  equipment: string;
  user: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  stale: boolean;
  mtime: string;
};

export const LOCK_STALE_MS = 1000 * 60 * 60 * 10; // 10 hours

function normalizeKey(value: string) {
  return String(value || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function computeExpiry(base = Date.now()) {
  return new Date(base + LOCK_STALE_MS).toISOString();
}

function mapRow(row: any): LockInfo {
  const updatedAt = row?.updated_at || row?.locked_at || row?.created_at || nowIso();
  const expiresAt = row?.expires_at || computeExpiry(new Date(updatedAt).getTime());
  const stale = new Date(expiresAt).getTime() <= Date.now();

  return {
    site: row?.site || '',
    equipment: row?.equipment || '',
    user: row?.user_name || '',
    createdAt: row?.created_at || updatedAt,
    updatedAt,
    expiresAt,
    stale,
    mtime: updatedAt,
  };
}

export async function readLock(site: string, equipment: string): Promise<LockInfo | null> {
  return getLockMeta(site, equipment);
}

export async function getLockMeta(site: string, equipment: string): Promise<LockInfo | null> {
  const supabase = createServerClient();
  const siteKey = normalizeKey(site);
  const equipmentKey = normalizeKey(equipment);

  const { data, error } = await supabase
    .from('edit_locks')
    .select('*')
    .eq('site', siteKey)
    .eq('equipment', equipmentKey)
    .maybeSingle();

  if (error) {
    console.error('[lock-utils:getLockMeta] error', error);
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function writeLock(site: string, equipment: string, user: string): Promise<LockInfo> {
  const supabase = createServerClient();
  const siteKey = normalizeKey(site);
  const equipmentKey = normalizeKey(equipment);
  const userName = normalizeKey(user);
  const current = await getLockMeta(siteKey, equipmentKey);
  const timestamp = nowIso();
  const expiresAt = computeExpiry();

  const payload = {
    site: siteKey,
    equipment: equipmentKey,
    user_name: userName,
    locked_at: current?.createdAt || timestamp,
    created_at: current?.createdAt || timestamp,
    updated_at: timestamp,
    expires_at: expiresAt,
  };

  const { data, error } = await supabase
    .from('edit_locks')
    .upsert(payload, { onConflict: 'site,equipment' })
    .select('*')
    .single();

  if (error) {
    console.error('[lock-utils:writeLock] error', error);
    throw new Error(error.message);
  }

  return mapRow(data);
}

export async function removeLock(site: string, equipment: string) {
  const supabase = createServerClient();
  const siteKey = normalizeKey(site);
  const equipmentKey = normalizeKey(equipment);

  const { error } = await supabase
    .from('edit_locks')
    .delete()
    .eq('site', siteKey)
    .eq('equipment', equipmentKey);

  if (error) {
    console.error('[lock-utils:removeLock] error', error);
    throw new Error(error.message);
  }
}
