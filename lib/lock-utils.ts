/**
 * DB 기반 락 유틸리티
 * 기존 파일 기반 lock-utils와 동일한 인터페이스 유지
 * → acquire-lock / release-lock / lock-status 라우트 수정 불필요
 */
import { createServerClient } from './supabase';

export type LockInfo = {
  site: string;
  equipment: string;
  user: string;
  createdAt: string;
  updatedAt: string;
};

export const LOCK_STALE_MS = 1000 * 60 * 60 * 10; // 10시간

/**
 * 락 메타 조회 (stale 여부 포함)
 * 파일 기반: stat().mtime → DB 기반: updated_at 컬럼
 */
export async function getLockMeta(site: string, equipment: string) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('edit_locks')
    .select('*')
    .eq('site', site)
    .eq('equipment', equipment)
    .maybeSingle();

  if (error || !data) return null;

  const updatedAt = data.updated_at as string;
  const age = Date.now() - new Date(updatedAt).getTime();
  const stale = age > LOCK_STALE_MS;

  return {
    site: data.site as string,
    equipment: data.equipment as string,
    user: data.user_name as string,
    createdAt: data.locked_at as string,
    updatedAt,
    stale,
    mtime: updatedAt, // 파일 기반 호환성 유지
  };
}

/**
 * 락 생성/갱신 (upsert)
 * 기존 락이 있으면 createdAt 유지, updatedAt만 갱신
 */
export async function writeLock(
  site: string,
  equipment: string,
  user: string
): Promise<LockInfo> {
  const supabase = createServerClient();

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + LOCK_STALE_MS).toISOString();

  const existing = await getLockMeta(site, equipment);
  const lockedAt = existing?.createdAt ?? now;

  const { data, error } = await supabase
    .from('edit_locks')
    .upsert(
      {
        site,
        equipment,
        user_name: user,
        locked_at: lockedAt,
        expires_at: expiresAt,
        updated_at: now,
      },
      { onConflict: 'site,equipment' }
    )
    .select()
    .single();

  if (error) throw error;

  return {
    site,
    equipment,
    user,
    createdAt: data.locked_at as string,
    updatedAt: data.updated_at as string,
  };
}

/**
 * 락 삭제
 */
export async function removeLock(
  site: string,
  equipment: string
): Promise<void> {
  const supabase = createServerClient();

  await supabase
    .from('edit_locks')
    .delete()
    .eq('site', site)
    .eq('equipment', equipment);
}
