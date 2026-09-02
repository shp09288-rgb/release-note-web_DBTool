import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { parseVersionRange } from '@/lib/version';
import { extractPmsNumbers } from '@/lib/pms/extract';
import type { DeploymentDraft } from '@/lib/queries/types';
import type { ParsedImprovement } from '@/lib/parsers/types';

type LegacyDetail = { ref?: string; category?: string; title?: string; desc?: string };

type LegacyHistory = {
  date?: string;
  xea?: string;
  xes?: string;
  cim?: string;
  summary?: string;
};

export type LegacyFile = {
  fileName: string;
  site: string;
  equipment: string;
  history: LegacyHistory[];
  xeaDetails: LegacyDetail[];
  xesDetails: LegacyDetail[];
};

export type MigrationReport = {
  total: number;
  bySite: Record<string, number>;
  unparsedVersions: number;
  withPmsRefs: number;
  gaps: Array<{ site: string; equipment: string; component: 'xea' | 'xes'; between: string }>;
};

/**
 * data/*.json 을 읽는다.
 *
 * 'LGD AP4_EQ01.json'(공백)과 'LGD_AP4_EQ01.json'(밑줄)은 내용이 같다.
 * 공백 파일명 쪽을 버린다.
 */
export function loadLegacyFiles(dir: string): LegacyFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .filter((name) => !name.includes(' ')) // 공백 파일명 중복 제외
    .map((fileName) => {
      const raw = JSON.parse(readFileSync(path.join(dir, fileName), 'utf-8'));
      return {
        fileName,
        site: String(raw.site ?? '').trim(),
        equipment: String(raw.equipmentId ?? 'EQ01').trim() || 'EQ01',
        history: (raw.history ?? []) as LegacyHistory[],
        xeaDetails: (raw.xeaDetails ?? []) as LegacyDetail[],
        xesDetails: (raw.xesDetails ?? []) as LegacyDetail[],
      };
    });
}

function detailsToItems(file: LegacyFile) {
  const build = (list: LegacyDetail[], component: 'xea' | 'xes', offset: number) =>
    list.map((d, idx) => {
      const improvements: ParsedImprovement[] = d.desc
        ? [{ component, lines: [String(d.desc)] }]
        : [];
      const pms = extractPmsNumbers(String(d.ref ?? ''));
      return {
        pmsNo: pms[0] ?? null,
        pmsExtra: pms.slice(1),
        anchorId: `legacy-${component}-${idx}`,
        section: String(d.category ?? ''),
        sectionNo: 0,
        title: String(d.title ?? ''),
        phenomenon: '',
        improvements,
        flags: [] as string[],
        sortOrder: offset + idx,
      };
    });

  const xea = build(file.xeaDetails, 'xea', 0);
  return [...xea, ...build(file.xesDetails, 'xes', xea.length)];
}

/**
 * history 행 하나를 배포 1건으로 바꾼다.
 *
 * 레거시 요약은 여러 항목이 한 덩어리라 신뢰할 만하게 쪼갤 수 없다.
 * 그래서 items 는 비우고 body_text 에 통째로 넣는다.
 * 예외로 각 설비의 최신 1건만 xeaDetails/xesDetails 를 항목으로 옮긴다.
 */
export function toDrafts(file: LegacyFile): DeploymentDraft[] {
  const hasDetails = file.xeaDetails.length + file.xesDetails.length > 0;

  return file.history.map((row, index) => {
    const xea = parseVersionRange(String(row.xea ?? ''));
    const xes = parseVersionRange(String(row.xes ?? ''));
    const summary = String(row.summary ?? '');
    const isLatest = index === 0;

    return {
      site: file.site,
      equipment: file.equipment,
      model: '',
      deployedOn: String(row.date ?? '').trim() || null,
      xeaFromRaw: xea.fromRaw, xeaFromBuild: xea.fromBuild,
      xeaToRaw: xea.toRaw,     xeaToBuild: xea.toBuild,
      xesFromRaw: xes.fromRaw, xesFromBuild: xes.fromBuild,
      xesToRaw: xes.toRaw,     xesToBuild: xes.toBuild,
      cimVer: String(row.cim ?? '').replace(/^-$/, ''),
      author: '',
      sourceKind: 'legacy_json' as const,
      sourceFile: file.fileName,
      rawHtml: null,
      edited: false,
      items: isLatest && hasDetails ? detailsToItems(file) : [],
      alarms: [],
      legacyPmsRefs: extractPmsNumbers(summary),
      // 레거시는 items 가 비어 있으므로 body_text 를 요약으로 직접 채운다.
      // 이게 없으면 전문 검색에서 과거 기록이 통째로 빠진다.
      bodyText: summary,
    };
  });
}

export function buildReport(drafts: DeploymentDraft[]): MigrationReport {
  const bySite: Record<string, number> = {};
  let unparsedVersions = 0;
  let withPmsRefs = 0;

  for (const d of drafts) {
    bySite[d.site] = (bySite[d.site] ?? 0) + 1;
    if (d.xeaToRaw && d.xeaToBuild === null) unparsedVersions += 1;
    if (d.xesToRaw && d.xesToBuild === null) unparsedVersions += 1;
    if ((d.legacyPmsRefs ?? []).length) withPmsRefs += 1;
  }

  return { total: drafts.length, bySite, unparsedVersions, withPmsRefs, gaps: [] };
}

/**
 * 검증 결과로 이관을 중단해야 하는지 판단한다.
 *
 * 후보가 있는데 유효한 게 하나도 없으면 십중팔구 Redmine 접속 실패다
 * (VPN 끊김, 키 만료, 서버 재기동 등) — 진짜로 모든 번호가 가짜일 가능성보다
 * 훨씬 높다. fetchIssue 는 모든 실패를 null 로 뭉뚱그리므로 이 둘을 구분할
 * 수 없다. 그래서 이 경우엔 아예 쓰지 않고 멈춘다.
 */
export function shouldAbortOnValidation(candidateCount: number, validCount: number): boolean {
  return candidateCount > 0 && validCount === 0;
}

/** DB 에 쓰는 부분. 위 순수 함수들과 분리해 둔다. */
async function runMigration() {
  const { insertDeployment } = await import('@/lib/queries/deployments');
  const { fetchIssue } = await import('@/lib/pms/redmine');

  const dir = path.resolve(process.cwd(), 'data');
  const files = loadLegacyFiles(dir);
  const drafts = files.flatMap(toDrafts);

  console.log(`[migrate] ${files.length}개 설비, 배포 ${drafts.length}건`);

  // PMS 번호 검증 — 오탐을 걸러낸다. 존재하지 않는 번호는 버린다.
  const candidates = new Set(drafts.flatMap((d) => d.legacyPmsRefs ?? []));
  const valid = new Set<number>();
  console.log(`[migrate] PMS 번호 후보 ${candidates.size}개 검증 중...`);

  for (const id of candidates) {
    const issue = await fetchIssue(id);
    if (issue) valid.add(id);
  }
  const discarded = candidates.size - valid.size;
  console.log(`[migrate] 유효 ${valid.size}개 / 버림 ${discarded}개`);

  if (shouldAbortOnValidation(candidates.size, valid.size)) {
    console.error(
      `[migrate] 중단: PMS 후보 ${candidates.size}개 중 검증된 게 하나도 없습니다. ` +
        `모든 번호가 가짜일 가능성보다 Redmine 접속 실패(VPN, PMS_API_KEY, 서버 상태)일 ` +
        `가능성이 훨씬 높습니다. 연결 상태를 확인한 뒤 다시 실행하세요. 아무것도 쓰지 않았습니다.`
    );
    process.exit(1);
  }

  let written = 0;
  for (const draft of drafts) {
    draft.legacyPmsRefs = (draft.legacyPmsRefs ?? []).filter((n) => valid.has(n));
    await insertDeployment(draft);
    written += 1;
    if (written % 10 === 0) console.log(`[migrate] ${written}/${drafts.length}`);
  }

  const report = buildReport(drafts);
  console.log('\n=== 이관 리포트 ===');
  console.log(`총 배포        : ${report.total}`);
  console.log(`설비별         :`, report.bySite);
  console.log(`버전 파싱 실패 : ${report.unparsedVersions}`);
  console.log(`PMS 참조 보유  : ${report.withPmsRefs}건`);
  console.log(`PMS 후보 검증  : 후보 ${candidates.size}개 중 유효 ${valid.size}개, 버림 ${discarded}개`);
}

if (process.argv[1] && process.argv[1].includes('migrate-legacy')) {
  runMigration().catch((err) => {
    console.error('[migrate] 실패:', err);
    process.exit(1);
  });
}
