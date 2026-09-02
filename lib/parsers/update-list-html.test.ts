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

describe('parseUpdateListHtml — 항목', () => {
  let doc: ParsedDocument;
  beforeAll(() => {
    doc = parseUpdateListHtml(readFileSync(FIXTURE, 'utf-8'));
  });

  it('항목 34건을 읽는다', () => {
    expect(doc.items).toHaveLength(34);
  });

  it('섹션 이름과 번호를 붙인다', () => {
    const first = doc.items[0];
    expect(first.sectionNo).toBe(1);
    expect(first.section).toBe('CIM');
  });

  it('섹션 0(표기 안내)은 항목으로 세지 않는다', () => {
    expect(doc.items.every((i) => i.sectionNo > 0)).toBe(true);
  });

  it('섹션별 항목 수가 맞는다', () => {
    const counts = doc.items.reduce<Record<number, number>>((acc, i) => {
      acc[i.sectionNo] = (acc[i.sectionNo] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ 1: 2, 2: 2, 3: 5, 4: 8, 5: 3, 6: 5, 7: 5, 8: 4 });
  });

  it('PMS 번호는 링크 href 에서 읽는다', () => {
    const item = doc.items.find((i) => i.anchorId === 'p4552')!;
    expect(item.pmsNo).toBe(4552);
    expect(item.title).toBe('CIM 불안정');
  });

  it('PMS 번호가 여러 개면 첫째가 pmsNo, 나머지가 pmsExtra', () => {
    const item = doc.items.find((i) => i.anchorId === 'p4705')!;
    expect(item.pmsNo).toBe(4705);
    expect(item.pmsExtra).toEqual([4711]);
  });

  it('PMS 번호가 없는 항목도 앵커로 살린다', () => {
    const item = doc.items.find((i) => i.anchorId === 'pjobresult')!;
    expect(item.pmsNo).toBeNull();
    expect(item.title).toContain('Job Result');
  });

  it('현상을 읽고 "현상" 라벨을 제거한다', () => {
    const item = doc.items.find((i) => i.anchorId === 'p4552')!;
    expect(item.phenomenon).toContain('CIM 무응답');
    expect(item.phenomenon.startsWith('현상')).toBe(false);
  });

  it('개선을 XEA / XES 로 나눠 읽는다', () => {
    const item = doc.items.find((i) => i.anchorId === 'p4552')!;
    const xea = item.improvements.find((g) => g.component === 'xea')!;
    const xes = item.improvements.find((g) => g.component === 'xes')!;
    expect(xea.lines[0]).toContain('GlassExchangeState');
    expect(xes.lines.length).toBe(4);
  });

  it('배지 클래스를 그대로 플래그에 담는다', () => {
    expect(doc.items.filter((i) => i.flags.includes('a5'))).toHaveLength(8);
    expect(doc.items.filter((i) => i.flags.includes('prev'))).toHaveLength(16);
  });

  it('범례 문구에서 "미적용" 의미를 유도해 not_applied 를 붙인다', () => {
    // 배지 클래스 이름('prev')을 코드에 박지 않는다. 문서가 섹션 0에서
    // 'prev = 6월 29일 전달분 (미적용)' 이라고 스스로 정의한 것을 읽는다.
    expect(doc.items.filter((i) => i.flags.includes('not_applied'))).toHaveLength(16);
  });

  it('미적용이 아닌 항목에는 not_applied 가 없다', () => {
    const applied = doc.items.filter((i) => !i.flags.includes('prev'));
    expect(applied.every((i) => !i.flags.includes('not_applied'))).toBe(true);
  });

  it('범례 문구에서 "요청" 의미를 유도해 site_requested 를 붙인다', () => {
    expect(doc.items.filter((i) => i.flags.includes('site_requested'))).toHaveLength(8);
  });

  it('bodyText 에 제목·현상·개선이 모두 들어간다 (전문 검색용)', () => {
    const item = doc.items.find((i) => i.anchorId === 'p4552')!;
    expect(item.bodyText).toContain('CIM 불안정');
    expect(item.bodyText).toContain('LinkWatchdog');
  });

  it('sortOrder 가 문서 순서대로 0부터 매겨진다', () => {
    expect(doc.items.map((i) => i.sortOrder)).toEqual(
      doc.items.map((_, idx) => idx)
    );
  });
});

describe('parseUpdateListHtml — 항목 견고성', () => {
  it('구조가 깨진 항목에도 예외를 던지지 않는다', () => {
    const doc = parseUpdateListHtml(
      '<section id="s1"><h2 class="s"><span class="n">1</span>CIM</h2>' +
        '<div class="item"><h3 class="s">제목만 있음</h3></div></section>'
    );
    expect(doc.items).toHaveLength(1);
    expect(doc.items[0].pmsNo).toBeNull();
    expect(doc.items[0].title).toBe('제목만 있음');
  });

  it('id 가 없는 헤딩에도 안정 앵커를 만든다', () => {
    const doc = parseUpdateListHtml(
      '<section id="s1"><h2 class="s"><span class="n">1</span>CIM</h2>' +
        '<div class="item"><h3 class="s">제목만 있음</h3></div></section>'
    );
    expect(doc.items[0].anchorId).toBeTruthy();
  });
});

describe('parseUpdateListHtml — 신규 Alarm', () => {
  let doc: ParsedDocument;
  beforeAll(() => {
    doc = parseUpdateListHtml(readFileSync(FIXTURE, 'utf-8'));
  });

  it('알람 3건을 읽는다', () => {
    expect(doc.alarms).toHaveLength(3);
  });

  it('알람 ID 와 텍스트를 읽는다', () => {
    const alarm = doc.alarms.find((a) => a.alarmId === '20144')!;
    expect(alarm.text).toBe('[XYStage] : Air Pressure is abnormal. 불일치 축 / Clamp 정보 포함');
  });

  it('출처 PMS 번호를 링크에서 읽는다', () => {
    const alarm = doc.alarms.find((a) => a.alarmId === '20158')!;
    expect(alarm.pmsNo).toBe(4881);
  });

  it('헤더 행(th)을 알람으로 세지 않는다', () => {
    expect(doc.alarms.every((a) => /^\d+$/.test(a.alarmId))).toBe(true);
  });
});
