import { describe, it, expect } from 'vitest';
import { findGaps } from '@/lib/timeline';

const dep = (id: string, xeaFrom: number | null, xeaTo: number | null) => ({
  id,
  xea_from_build: xeaFrom,
  xea_to_build: xeaTo,
  xes_from_build: null,
  xes_to_build: null,
});

describe('findGaps', () => {
  it('이어지는 배포에는 끊김이 없다', () => {
    // 최신순 입력: 3600에서 3700, 그 전이 3500에서 3600
    const gaps = findGaps([dep('b', 3600, 3700), dep('a', 3500, 3600)]);
    expect(gaps).toHaveLength(0);
  });

  it('앞 배포의 to 와 뒤 배포의 from 이 다르면 끊김', () => {
    const gaps = findGaps([dep('b', 3650, 3700), dep('a', 3500, 3600)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      component: 'xea',
      fromBuild: 3600,
      toBuild: 3650,
      newerId: 'b',
      olderId: 'a',
    });
  });

  it('빌드 번호를 못 읽은 배포는 판단하지 않는다', () => {
    expect(findGaps([dep('b', null, 3700), dep('a', 3500, null)])).toHaveLength(0);
  });

  it('from 이 없는 단일 값 배포(레거시)는 판단하지 않는다', () => {
    expect(findGaps([dep('b', null, 3700), dep('a', null, 3600)])).toHaveLength(0);
  });

  it('배포가 1건이면 끊김이 없다', () => {
    expect(findGaps([dep('a', 3500, 3600)])).toHaveLength(0);
  });

  it('newer 의 from 이 older 의 to 보다 낮으면(방향 역전) 끊김을 단정하지 않는다', () => {
    // 정렬이나 데이터가 가정과 다르다는 신호이므로 건너뛴다.
    expect(findGaps([dep('b', 3500, 3600), dep('a', 3600, 3700)])).toHaveLength(0);
  });
});
