import { createHash } from 'crypto';
import { createServerClient } from '@/lib/supabase';

const PASSWORD_KEY = 'dashboard_password_hash';
const DEFAULT_PASSWORD = '0212';
const DEFAULT_HASH = sha256(DEFAULT_PASSWORD);

export function sha256(value: string) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export async function getStoredPasswordHash() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('dashboard_settings')
    .select('value')
    .eq('key', PASSWORD_KEY)
    .maybeSingle();

  if (error) {
    if ((error as any).code === '42P01') return null;
    throw new Error(error.message);
  }

  return data?.value || null;
}

export async function verifyDashboardPassword(password: string) {
  const storedHash = await getStoredPasswordHash();
  return sha256(password) === (storedHash || DEFAULT_HASH);
}

export async function updateDashboardPassword(nextPassword: string) {
  const supabase = createServerClient();
  const { error } = await supabase
    .from('dashboard_settings')
    .upsert(
      { key: PASSWORD_KEY, value: sha256(nextPassword), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) throw new Error(error.message);
}

export function getDefaultDashboardPassword() {
  return DEFAULT_PASSWORD;
}
