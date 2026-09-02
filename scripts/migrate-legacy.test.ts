import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  loadLegacyFiles,
  toDrafts,
  buildReport,
  shouldAbortOnValidation,
  findMissingEnvVars,
} from '@/scripts/migrate-legacy';

const DATA_DIR = path.resolve(__dirname, '../data');

describe('loadLegacyFiles', () => {
  it('공백 파일명 중복(LGD AP4)을 제외하고 5개 설비를 읽는다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    expect(files).toHaveLength(5);
    expect(files.some((f) => f.fileName.includes('LGD AP4'))).toBe(false);
  });

  it('site 와 equipment 를 채운다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    const a5 = files.find((f) => f.site === 'SDC A5')!;
    expect(a5.equipment).toBe('EQ01');
  });

  it('equipmentId 가 없으면 EQ01 로 채운다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    expect(files.every((f) => f.equipment)).toBe(true);
  });
});

describe('toDrafts', () => {
  it('history 행마다 배포 1건을 만든다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    const a6 = files.find((f) => f.site === 'SDC A6')!;
    expect(toDrafts(a6)).toHaveLength(58);
  });

  it('레거시는 항목을 만들지 않는다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    const a6 = files.find((f) => f.site === 'SDC A6')!;
    expect(toDrafts(a6).every((d) => d.items.length === 0)).toBe(true);
  });

  it('SDC A5 최신 1건만 항목을 정밀 이관한다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    const a5 = files.find((f) => f.site === 'SDC A5')!;
    const drafts = toDrafts(a5);
    const withItems = drafts.filter((d) => d.items.length > 0);
    expect(withItems).toHaveLength(1);
    // xeaDetails 5건 + xesDetails 3건
    expect(withItems[0].items).toHaveLength(8);
  });

  it('요약 텍스트에서 PMS 번호를 뽑아 둔다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    const total = files
      .flatMap(toDrafts)
      .filter((d) => (d.legacyPmsRefs ?? []).length > 0);
    expect(total.length).toBe(46);
  });

  it('모든 배포의 source_kind 가 legacy_json 이다', () => {
    const files = loadLegacyFiles(DATA_DIR);
    expect(files.flatMap(toDrafts).every((d) => d.sourceKind === 'legacy_json')).toBe(true);
  });
});

describe('buildReport', () => {
  it('전체 90건을 센다', () => {
    const drafts = loadLegacyFiles(DATA_DIR).flatMap(toDrafts);
    const report = buildReport(drafts);
    expect(report.total).toBe(90);
    expect(report.bySite['SDC A6']).toBe(58);
    expect(report.bySite['LGD AP3']).toBe(23);
  });

  it('빌드 번호를 못 읽은 건수를 센다', () => {
    const drafts = loadLegacyFiles(DATA_DIR).flatMap(toDrafts);
    expect(buildReport(drafts).unparsedVersions).toBeGreaterThan(0);
  });
});

describe('shouldAbortOnValidation', () => {
  it('후보가 없으면 abort 하지 않는다', () => {
    expect(shouldAbortOnValidation(0, 0)).toBe(false);
  });

  it('일부라도 유효하면 abort 하지 않는다', () => {
    expect(shouldAbortOnValidation(72, 40)).toBe(false);
  });

  it('후보는 있는데 유효한 게 하나도 없으면 abort 한다', () => {
    expect(shouldAbortOnValidation(72, 0)).toBe(true);
  });
});

describe('findMissingEnvVars', () => {
  it('필요한 변수가 다 있으면 빈 배열을 돌려준다', () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: 'x',
      SUPABASE_SERVICE_ROLE_KEY: 'y',
      PMS_API_KEY: 'z',
    };
    expect(findMissingEnvVars(env)).toEqual([]);
  });

  it('없는 변수의 이름만 콕 집어 돌려준다', () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: 'x' };
    expect(findMissingEnvVars(env)).toEqual(['SUPABASE_SERVICE_ROLE_KEY', 'PMS_API_KEY']);
  });

  it('빈 문자열도 없는 것으로 친다', () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: '  ',
      SUPABASE_SERVICE_ROLE_KEY: 'y',
      PMS_API_KEY: 'z',
    };
    expect(findMissingEnvVars(env)).toEqual(['NEXT_PUBLIC_SUPABASE_URL']);
  });
});
