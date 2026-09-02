export type BuildParse = {
  raw: string;
  build: number | null;
  warning?: string;
};

export type VersionRange = {
  fromRaw: string;
  fromBuild: number | null;
  toRaw: string;
  toBuild: number | null;
  warnings: string[];
};

const SEMVER = /\d+\.\d+\.\d+/g;
const BUILD = /(?:Dev\s*)?(\d{2,5})/gi;

/**
 * 빌드 번호 하나를 읽는다.
 *
 * 표기 변종이 많다: '5.2.5 Dev3592', '5.2.5 3271', '5.2.5 Dev 907', 'Dev635'.
 * 접근: 앞의 시맨틱 버전(5.2.5)을 지운 뒤 남은 숫자를 센다.
 * 정확히 하나면 그것이 빌드 번호, 둘 이상이면 오염된 값으로 보고 버린다.
 * 원문은 어떤 경우에도 보존한다.
 */
export function parseBuild(input: string): BuildParse {
  const raw = String(input ?? '').trim();

  if (!raw || raw === '-') {
    return { raw, build: null };
  }

  const stripped = raw.replace(SEMVER, ' ');
  const matches = [...stripped.matchAll(BUILD)].map((m) => Number(m[1]));

  if (matches.length === 0) {
    return { raw, build: null, warning: `빌드 번호를 찾지 못했습니다: "${raw}"` };
  }

  if (matches.length > 1) {
    return {
      raw,
      build: null,
      warning: `한 칸에 빌드 번호가 여러 개입니다: "${raw}"`,
    };
  }

  return { raw, build: matches[0] };
}

/**
 * 'A → B' 형태의 버전 구간을 읽는다.
 * 화살표가 없으면 단일 값으로 보고 to 에만 넣는다 — 레거시 history 행이 그렇다.
 */
export function parseVersionRange(input: string): VersionRange {
  const raw = String(input ?? '').trim().replace(/^\(|\)$/g, '').trim();
  const warnings: string[] = [];

  const parts = raw.split(/\s*(?:→|->)\s*/);

  if (parts.length === 2) {
    const from = parseBuild(parts[0]);
    const to = parseBuild(parts[1]);
    if (from.warning) warnings.push(from.warning);
    if (to.warning) warnings.push(to.warning);
    return {
      fromRaw: from.raw,
      fromBuild: from.build,
      toRaw: to.raw,
      toBuild: to.build,
      warnings,
    };
  }

  const to = parseBuild(raw);
  if (to.warning) warnings.push(to.warning);
  return { fromRaw: '', fromBuild: null, toRaw: to.raw, toBuild: to.build, warnings };
}
