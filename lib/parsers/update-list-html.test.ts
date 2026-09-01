import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseUpdateListHtml } from '@/lib/parsers/update-list-html';
import type { ParsedDocument } from '@/lib/parsers/types';

const FIXTURE = path.resolve(__dirname, '../../docs/SDC_A5_Update_List.html');

describe('parseUpdateListHtml — 헤더', () => {
  let doc: ParsedDocument;
  beforeAll(() => {
    doc = parseUpdateListHtml(readFileSync(FIXTURE, 'utf-8'));
  });

  it('설비 칸에서 사이트와 모델을 분리한다', () => {
    expect(doc.header.site).toBe('SDC A5');
    expect(doc.header.model).toBe('NX-TSH2225 #1');
  });

  it('설비 번호는 문서에 없으므로 null 이고 경고를 남긴다', () => {
    expect(doc.header.equipment).toBeNull();
    expect(doc.warnings.some((w) => w.field === 'equipment')).toBe(true);
  });

  it('XEA 버전 구간을 읽는다', () => {
    expect(doc.header.xeaFromBuild).toBe(3592);
    expect(doc.header.xeaToBuild).toBe(4317);
  });

  it('XEService 칸을 XES 로 읽는다', () => {
    expect(doc.header.xesFromBuild).toBe(1609);
    expect(doc.header.xesToBuild).toBe(2015);
  });

  it('작성자를 읽는다', () => {
    expect(doc.header.author).toContain('이호연');
  });
});

describe('parseUpdateListHtml — 배지 범례', () => {
  it('문서가 스스로 정의한 배지 의미를 학습한다', () => {
    const doc = parseUpdateListHtml(readFileSync(FIXTURE, 'utf-8'));
    expect(doc.legend.a5).toContain('SDC A5');
    expect(doc.legend.prev).toContain('미적용');
  });
});

describe('parseUpdateListHtml — 견고성', () => {
  it('빈 문자열에도 예외를 던지지 않는다', () => {
    const doc = parseUpdateListHtml('');
    expect(doc.items).toEqual([]);
    expect(doc.warnings.length).toBeGreaterThan(0);
  });

  it('헤더가 없는 HTML 에도 예외를 던지지 않는다', () => {
    const doc = parseUpdateListHtml('<html><body><p>hello</p></body></html>');
    expect(doc.header.site).toBeNull();
    expect(doc.warnings.length).toBeGreaterThan(0);
  });
});
