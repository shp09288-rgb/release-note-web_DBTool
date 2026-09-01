import { describe, it, expect } from 'vitest';
import { parseBuild, parseVersionRange } from '@/lib/version';

describe('parseBuild', () => {
  it('Dev 접두사가 붙은 빌드 번호를 읽는다', () => {
    expect(parseBuild('5.2.5 Dev3592').build).toBe(3592);
  });

  it('Dev 없이 숫자만 있어도 읽는다', () => {
    expect(parseBuild('5.2.5 3271').build).toBe(3271);
  });

  it('Dev와 숫자 사이 공백을 허용한다', () => {
    expect(parseBuild('5.2.5 Dev 907').build).toBe(907);
  });

  it('버전 접두사 없이 Dev만 있어도 읽는다', () => {
    expect(parseBuild('Dev635').build).toBe(635);
  });

  it('하이픈은 미변경으로 본다', () => {
    expect(parseBuild('-').build).toBeNull();
  });

  it('빈 문자열은 미변경으로 본다', () => {
    expect(parseBuild('').build).toBeNull();
  });

  it('한 칸에 두 컴포넌트가 섞인 오염된 값은 null + 경고', () => {
    const result = parseBuild('5.2.5 Dev3389 XES 5.2.5 Dev1417');
    expect(result.build).toBeNull();
    expect(result.warning).toContain('여러');
  });

  it('원문은 언제나 보존한다', () => {
    expect(parseBuild('  5.2.5 Dev 907 ').raw).toBe('5.2.5 Dev 907');
  });
});

describe('parseVersionRange', () => {
  it('유니코드 화살표 구간을 읽는다', () => {
    const r = parseVersionRange('Dev3592 → Dev4317');
    expect(r.fromBuild).toBe(3592);
    expect(r.toBuild).toBe(4317);
  });

  it('ASCII 화살표와 괄호를 읽는다', () => {
    const r = parseVersionRange('(Dev3493 -> Dev3581)');
    expect(r.fromBuild).toBe(3493);
    expect(r.toBuild).toBe(3581);
  });

  it('단일 값은 to 로만 본다 (레거시 history 행)', () => {
    const r = parseVersionRange('5.2.5 Dev3592');
    expect(r.fromBuild).toBeNull();
    expect(r.toBuild).toBe(3592);
    expect(r.toRaw).toBe('5.2.5 Dev3592');
  });

  it('오염된 단일 값은 경고를 남긴다', () => {
    const r = parseVersionRange('5.2.5 Dev3389 XES 5.2.5 Dev1417');
    expect(r.toBuild).toBeNull();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
