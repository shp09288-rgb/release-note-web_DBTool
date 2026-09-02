import { describe, expect, it } from 'vitest';
import { buildSearchOrFilter } from '@/lib/queries/deployments';

describe('buildSearchOrFilter', () => {
  it('builds an ilike clause per column for a plain term', () => {
    expect(buildSearchOrFilter('timeout', ['title', 'phenomenon', 'body_text'])).toBe(
      'title.ilike."%timeout%",phenomenon.ilike."%timeout%",body_text.ilike."%timeout%"'
    );
  });

  it('wraps a term containing a comma in quotes so PostgREST treats it as literal', () => {
    // 콤마 자체는 문자열에 남지만, 큰따옴표로 감싸여 있으므로 PostgREST 의
    // `.or()` 파서가 이를 필터 구분자가 아닌 값의 일부로 읽는다.
    expect(buildSearchOrFilter('Timeout, AmpFault', ['title'])).toBe(
      'title.ilike."%Timeout, AmpFault%"'
    );
  });

  it('quotes a term containing parentheses', () => {
    const result = buildSearchOrFilter('gantry (reset)', ['title']);
    expect(result).toBe('title.ilike."%gantry (reset)%"');
  });

  it('escapes an embedded double quote', () => {
    const result = buildSearchOrFilter('say "hi"', ['title']);
    expect(result).toBe('title.ilike."%say \\"hi\\"%"');
  });

  it('escapes an embedded backslash before quoting the double quote', () => {
    const result = buildSearchOrFilter('a\\"b', ['title']);
    expect(result).toBe('title.ilike."%a\\\\\\"b%"');
  });

  it('passes a Korean term through unescaped', () => {
    expect(buildSearchOrFilter('갠트리 리셋 실패', ['title', 'phenomenon'])).toBe(
      'title.ilike."%갠트리 리셋 실패%",phenomenon.ilike."%갠트리 리셋 실패%"'
    );
  });
});
