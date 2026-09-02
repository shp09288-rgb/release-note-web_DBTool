import { describe, it, expect, vi } from 'vitest';
import { parseOriginSite, pickCustomField, fetchIssue } from '@/lib/pms/redmine';

describe('parseOriginSite', () => {
  it('대괄호 접두사에서 사이트를 뽑는다', () => {
    expect(parseOriginSite('[SDC A3] NX-TSH1518 #1 /[PMS] CIM 불안정 건')).toBe('SDC A3');
  });

  it('슬래시로 시작하는 제목에서도 뽑는다', () => {
    expect(
      parseOriginSite('SDC A5 / NX-TSH2225 #1 / 측정 끝난 후 Fatal following error')
    ).toBe('SDC A5');
  });

  it('사이트를 못 찾으면 null', () => {
    expect(parseOriginSite('그냥 제목')).toBeNull();
  });

  it('장비 모델 코드만 있으면 null — NX-TSH1518 은 사이트가 아니다', () => {
    expect(parseOriginSite('NX-TSH1518 #1 /[PMS] CIM 불안정 건')).toBeNull();
  });

  it('모델 코드가 본문 중간에 있어도 null', () => {
    expect(parseOriginSite('AFM 장비 NX-TSH1518 오류')).toBeNull();
  });

  it('대괄호 안이 모델 코드면 null', () => {
    expect(parseOriginSite('[NX-TSH1518] #1 some subject')).toBeNull();
  });

  it('LGD 사이트는 벤더+팹 전체를 뽑는다', () => {
    expect(parseOriginSite('LGD AP3 / 설비 이슈')).toBe('LGD AP3');
  });
});

describe('pickCustomField', () => {
  it('이름으로 값을 찾는다', () => {
    const fields = [
      { id: 5, name: 'Software Version', value: 'XEA 5.2.5 D3768' },
      { id: 24, name: 'XEService Version', value: 'XEA 5.2.5 D1609' },
    ];
    expect(pickCustomField(fields, 'Software Version')).toBe('XEA 5.2.5 D3768');
  });

  it('없으면 빈 문자열', () => {
    expect(pickCustomField([], 'Software Version')).toBe('');
  });
});

describe('fetchIssue', () => {
  const issue = {
    issue: {
      id: 4952,
      subject: 'SDC A5 / NX-TSH2225 #1 / Fatal following error',
      status: { name: 'In Progress', is_closed: false },
      tracker: { name: 'SR' },
      priority: { name: 'High' },
      author: { name: '노승범' },
      assigned_to: { name: '이호연' },
      custom_fields: [{ id: 5, name: 'Software Version', value: 'XEA 5.2.5 D3768' }],
      created_on: '2026-08-21T03:00:06Z',
      updated_on: '2026-08-27T01:22:38Z',
      closed_on: null,
    },
  };

  it('이슈를 정규화해 돌려준다', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => issue,
    });
    const result = await fetchIssue(4952, { fetch: fakeFetch as any });
    expect(result?.issueId).toBe(4952);
    expect(result?.status).toBe('In Progress');
    expect(result?.isClosed).toBe(false);
    expect(result?.swVersion).toBe('XEA 5.2.5 D3768');
    expect(result?.originSite).toBe('SDC A5');
  });

  it('404 는 null 을 준다 — 없는 번호는 오탐이므로 버린다', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchIssue(999, { fetch: fakeFetch as any })).toBeNull();
  });

  it('네트워크 오류에도 예외를 던지지 않는다', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await fetchIssue(4952, { fetch: fakeFetch as any })).toBeNull();
  });
});
