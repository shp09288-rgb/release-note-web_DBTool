/**
 * 자유 텍스트에서 PMS 번호를 뽑는다. 레거시 요약에는 링크가 없고 '#4199' 처럼
 * 텍스트로만 적혀 있다.
 *
 * 3~5자리로 제한한다. 'NX-TSH2225 #1' 같은 설비 표기를 PMS 번호로 잘못 잡지
 * 않기 위해서다. 그래도 오탐이 남으므로 호출부가 Redmine 으로 검증한다.
 */
export function extractPmsNumbers(text: string): number[] {
  const source = String(text ?? '');
  const seen = new Set<number>();
  const result: number[] = [];

  for (const match of source.matchAll(/#\s?(\d{3,5})\b/g)) {
    const value = Number(match[1]);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}
