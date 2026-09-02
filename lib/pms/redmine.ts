export type RedmineCustomField = { id: number; name: string; value: unknown };

export type PmsIssue = {
  issueId: number;
  subject: string;
  status: string;
  isClosed: boolean;
  tracker: string;
  priority: string;
  author: string;
  assignee: string;
  swVersion: string;
  xesVersion: string;
  /** 제목에서 뽑은 발생 사이트. 배포된 사이트와 다를 수 있다 — 그게 이 필드의 값이다. */
  originSite: string | null;
  createdOn: string | null;
  updatedOn: string | null;
  closedOn: string | null;
};

const SITE = /(?<![A-Za-z0-9-])([A-Z]{2,4}\s[A-Z]{1,2}\d{1,2})(?!\d)/;

/**
 * Redmine 제목에서 이슈가 발생한 사이트를 뽑는다.
 *
 * '#4552' 는 SDC A5 배포 문서의 항목이지만 제목은 '[SDC A3] ...' 이다.
 * A3 에서 제기된 수정이 A5 에 들어갔다는 뜻이고, 문서만 봐서는 알 수 없다.
 */
export function parseOriginSite(subject: string): string | null {
  const source = String(subject ?? '');

  const bracket = source.match(/^\s*\[([^\]]+)\]/);
  if (bracket) {
    const inner = bracket[1].match(SITE);
    if (inner) return inner[1].replace(/\s+/g, ' ').trim();
  }

  const head = source.split('/')[0] ?? '';
  const bare = head.match(SITE);
  if (bare) return bare[1].replace(/\s+/g, ' ').trim();

  return null;
}

export function pickCustomField(fields: RedmineCustomField[], name: string): string {
  const found = (fields ?? []).find((f) => f?.name === name);
  return found?.value == null ? '' : String(found.value);
}

/**
 * 이슈 하나를 조회한다.
 *
 * 실패하면 예외 대신 null 이다. PMS 는 선택적 의존이고, 여기서 던지면
 * 이관 스크립트와 업로드가 통째로 멈춘다.
 */
export async function fetchIssue(
  id: number,
  deps: { fetch?: typeof fetch } = {}
): Promise<PmsIssue | null> {
  const doFetch = deps.fetch ?? fetch;
  const base = process.env.PMS_BASE_URL || 'https://pms.parksystems.com';
  const key = process.env.PMS_API_KEY;

  try {
    const res = await doFetch(`${base}/issues/${id}.json`, {
      headers: key ? { 'X-Redmine-API-Key': key } : {},
    });

    if (!res.ok) return null;

    const body = (await res.json()) as { issue?: Record<string, any> };
    const issue = body?.issue;
    if (!issue) return null;

    const fields = (issue.custom_fields ?? []) as RedmineCustomField[];

    return {
      issueId: Number(issue.id),
      subject: String(issue.subject ?? ''),
      status: String(issue.status?.name ?? ''),
      isClosed: Boolean(issue.status?.is_closed),
      tracker: String(issue.tracker?.name ?? ''),
      priority: String(issue.priority?.name ?? ''),
      author: String(issue.author?.name ?? ''),
      assignee: String(issue.assigned_to?.name ?? ''),
      swVersion: pickCustomField(fields, 'Software Version'),
      xesVersion: pickCustomField(fields, 'XEService Version'),
      originSite: parseOriginSite(String(issue.subject ?? '')),
      createdOn: issue.created_on ?? null,
      updatedOn: issue.updated_on ?? null,
      closedOn: issue.closed_on ?? null,
    };
  } catch {
    return null;
  }
}
