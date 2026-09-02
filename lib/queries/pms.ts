import { createServerClient } from '@/lib/supabase';
import { fetchIssue } from '@/lib/pms/redmine';

export type PmsIssueRow = {
  issue_id: number;
  subject: string;
  status: string;
  is_closed: boolean;
  assignee: string;
  origin_site: string | null;
  updated_on: string | null;
};

export async function getCachedIssues(ids: number[]): Promise<Map<number, PmsIssueRow>> {
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n)))];
  if (!unique.length) return new Map();

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('pms_issues')
      .select('issue_id, subject, status, is_closed, assignee, origin_site, updated_on')
      .in('issue_id', unique);

    // 캐시는 선택적이다. 실패해도 화면은 떠야 한다.
    if (error) {
      console.error('[pms/cache]', error.message);
      return new Map();
    }

    return new Map((data ?? []).map((row: any) => [row.issue_id as number, row as PmsIssueRow]));
  } catch (err) {
    console.error('[pms/cache]', err);
    return new Map();
  }
}

/** DB 에 있는 모든 PMS 번호를 Redmine 에서 새로 받아 캐시에 채운다. */
export async function syncIssues(): Promise<{ fetched: number; failed: number }> {
  const supabase = createServerClient();

  const { data, error } = await supabase.from('deployment_pms_refs').select('pms_no');
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((r: any) => r.pms_no as number))];
  let fetched = 0;
  let failed = 0;

  for (const id of ids) {
    const issue = await fetchIssue(id);
    if (!issue) {
      failed += 1;
      continue;
    }

    const { error: upsertError } = await supabase.from('pms_issues').upsert({
      issue_id: issue.issueId,
      subject: issue.subject,
      status: issue.status,
      is_closed: issue.isClosed,
      tracker: issue.tracker,
      priority: issue.priority,
      author: issue.author,
      assignee: issue.assignee,
      sw_version: issue.swVersion,
      xes_version: issue.xesVersion,
      origin_site: issue.originSite,
      created_on: issue.createdOn,
      updated_on: issue.updatedOn,
      closed_on: issue.closedOn,
      fetched_at: new Date().toISOString(),
    });

    if (upsertError) failed += 1;
    else fetched += 1;
  }

  return { fetched, failed };
}
