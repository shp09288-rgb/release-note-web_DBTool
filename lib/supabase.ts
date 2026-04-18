import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * 서버 전용 클라이언트 (API Routes에서 사용)
 * Service Role Key 사용 → RLS 우회
 */
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * 브라우저 클라이언트 (Phase 2 Realtime 등에서 사용)
 * Anon Key 사용 → RLS 적용
 */
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}
