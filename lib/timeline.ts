export type TimelineGap = {
  component: 'xea' | 'xes';
  newerId: string;
  olderId: string;
  fromBuild: number;
  toBuild: number;
};

type GapInput = {
  id: string;
  xea_from_build: number | null;
  xea_to_build: number | null;
  xes_from_build: number | null;
  xes_to_build: number | null;
};

/**
 * 배포 사이에 기록되지 않은 구간이 있는지 찾는다.
 *
 * 앞선 배포가 Dev3600 에서 끝났는데 다음 배포가 Dev3650 에서 시작하면,
 * 3600~3650 사이의 배포가 기록되지 않았다는 뜻이다.
 *
 * 숨기지 않는다. '여기 기록이 비었다'는 이 도구가 알려줘야 할 정보다.
 * 단, 빌드 번호를 못 읽은 배포는 판단 근거가 없으므로 조용히 건너뛴다 —
 * 모르는 것을 끊김으로 단정하면 거짓 경고가 된다.
 *
 * 입력은 최신순(deployed_on DESC)을 가정한다.
 */
export function findGaps(deployments: GapInput[]): TimelineGap[] {
  const gaps: TimelineGap[] = [];
  const components: Array<'xea' | 'xes'> = ['xea', 'xes'];

  for (let i = 0; i < deployments.length - 1; i += 1) {
    const newer = deployments[i];
    const older = deployments[i + 1];

    for (const component of components) {
      const newerFrom = newer[`${component}_from_build`];
      const olderTo = older[`${component}_to_build`];

      if (newerFrom == null || olderTo == null) continue;
      if (newerFrom === olderTo) continue;

      gaps.push({
        component,
        newerId: newer.id,
        olderId: older.id,
        fromBuild: olderTo,
        toBuild: newerFrom,
      });
    }
  }

  return gaps;
}
