import { createHash } from 'crypto';
import { createServerClient } from '@/lib/supabase';

const DEFAULT_PASSWORD = '0212';

function sha256(value: string) {
  return createHash('sha256').update(String(value)).digest('hex');
}

export async function getDashboardPasswordInfo() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('dashboard_settings')
    .select('key, value')
    .in('key', ['dashboard_password', 'dashboard_password_hash']);

  if (error) {
    if ((error as any).code === '42P01') {
      return { plain: DEFAULT_PASSWORD, hash: sha256(DEFAULT_PASSWORD) };
    }
    throw new Error(error.message);
  }

  const map = new Map((data ?? []).map((row: any) => [row.key, String(row.value ?? '')]));
  return {
    plain: map.get('dashboard_password') || '',
    hash: map.get('dashboard_password_hash') || '',
  };
}

export async function verifyDashboardPassword(password: string) {
  const info = await getDashboardPasswordInfo();
  const input = String(password || '');

  if (info.plain) {
    return input === info.plain;
  }

  if (info.hash) {
    return sha256(input) === info.hash;
  }

  return input === DEFAULT_PASSWORD;
}

export async function updateDashboardPassword(nextPassword: string) {
  const supabase = createServerClient();
  const next = String(nextPassword || '');

  if (!next) {
    throw new Error('새 비밀번호를 입력해주세요.');
  }

  const { error } = await supabase
    .from('dashboard_settings')
    .upsert(
      [
        { key: 'dashboard_password', value: next, updated_at: new Date().toISOString() },
        { key: 'dashboard_password_hash', value: sha256(next), updated_at: new Date().toISOString() },
      ],
      { onConflict: 'key' }
    );

  if (error) throw new Error(error.message);
}

export function getDefaultDashboardPassword() {
  return DEFAULT_PASSWORD;
}
