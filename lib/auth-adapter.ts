/**
 * Auth Adapter - Phase 1/2 전환 포인트
 *
 * Phase 1: 로그인 없이 동작. API 요청 body의 user 필드 또는 null 반환
 * Phase 2: Supabase Auth 세션을 파싱하여 실제 사용자 반환
 *
 * 사용 예:
 *   const actor = await getCurrentActor(request);
 *   const userName = actor?.name ?? body.user ?? 'anonymous';
 */

export type Actor = {
  name: string;
  id?: string;
  email?: string;
};

/**
 * Phase 1: 항상 null 반환 (caller가 body.user 사용)
 *
 * Phase 2 전환 시 아래 주석 해제 후 적용:
 *   import { createServerClient } from './supabase';
 *
 *   const supabase = createServerClient();
 *   const authHeader = request?.headers.get('Authorization') ?? '';
 *   const token = authHeader.replace('Bearer ', '');
 *   const { data: { user } } = await supabase.auth.getUser(token);
 *   if (user) {
 *     return {
 *       name: user.user_metadata?.name ?? user.email ?? user.id,
 *       id: user.id,
 *       email: user.email,
 *     };
 *   }
 */
export async function getCurrentActor(_request?: Request): Promise<Actor | null> {
  return null;
}
