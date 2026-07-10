import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OUTLOOK_RELEASE_NOTE_FIXTURE,
  SIMPLE_BULK_FIXTURE,
} from '@/lib/release-note-bulk-parser.fixtures';
import {
  applyGroupNameToRows,
  extractPmsNumbers,
  findDuplicateRefWarnings,
  isExplicitGroupTitle,
  parseBulkDetailText,
  parsePmsHeader,
  refsHaveSamePmsNumbers,
  toDetailRows,
} from '@/lib/release-note-bulk-parser';

const IMPROVEMENT = 'Improvement' as const;

function parse(text: string) {
  return parseBulkDetailText({ text, defaultCategory: IMPROVEMENT });
}

function findByRef(rows: { ref: string }[], refPart: string) {
  return rows.find((row) => row.ref.includes(refPart));
}

describe('parsePmsHeader', () => {
  it('1. 단일 PMS 번호', () => {
    assert.deepEqual(parsePmsHeader('PMS #4705 Manual Tip Check'), {
      ref: 'PMS #4705',
      title: 'Manual Tip Check',
    });
  });

  it('2. 복수 PMS 번호 (쉼표)', () => {
    assert.deepEqual(parsePmsHeader('PMS #4705, #4711 Manual Tip Check'), {
      ref: 'PMS #4705, #4711',
      title: 'Manual Tip Check',
    });
  });

  it('3. PMS#4705 공백 없음', () => {
    assert.deepEqual(parsePmsHeader('PMS#4705 제목'), {
      ref: 'PMS #4705',
      title: '제목',
    });
  });

  it('4. PMS 단어 반복 복수 번호', () => {
    assert.deepEqual(parsePmsHeader('PMS #4705, PMS #4711 제목'), {
      ref: 'PMS #4705, #4711',
      title: '제목',
    });
  });

  it('5. 슬래시 구분', () => {
    assert.deepEqual(parsePmsHeader('PMS #4705 / #4711 제목'), {
      ref: 'PMS #4705, #4711',
      title: '제목',
    });
  });
});

describe('parseBulkDetailText — 기본', () => {
  it('6. Outlook bullet', () => {
    const result = parse('• PMS #4045 Detector Cal');
    assert.equal(result.rows[0]?.ref, 'PMS #4045');
  });

  it('7. 탭 및 연속 공백', () => {
    const result = parse('\t  PMS   #4045   Detector Cal');
    assert.equal(result.rows[0]?.title, 'Detector Cal');
  });

  it('8. desc 한 줄', () => {
    const result = parse(`PMS #4045 Detector Cal
Alarm ID: 90053`);
    assert.equal(result.rows[0]?.desc, 'Alarm ID: 90053');
  });

  it('9. desc 여러 줄', () => {
    const result = parse(`PMS #4074 Indexer Timeout
Alarm ID: 90053
Alarm Text: load/unload sequence failed`);
    assert.equal(
      result.rows[0]?.desc,
      'Alarm ID: 90053\nAlarm Text: load/unload sequence failed'
    );
  });

  it('10. 빈 줄 포함', () => {
    const result = parse(`PMS #4045 Detector Cal

Alarm ID: 90053`);
    assert.equal(result.summary.pmsCount, 1);
    assert.match(result.rows[0]?.desc ?? '', /Alarm ID/);
  });

  it('11. 첫 줄이 PMS가 아닌 경우', () => {
    const result = parse('일반 문장\nPMS #4045 Detector Cal');
    assert.equal(result.unclassifiedLines[0], '일반 문장');
    assert.equal(result.rows[0]?.ref, 'PMS #4045');
  });

  it('12. 빈 입력', () => {
    const result = parse('   \n  ');
    assert.equal(result.rows.length, 0);
  });

  it('13. 한글/영문/특수문자 혼합', () => {
    const result = parse('PMS #3622 PLC Monitor & EMO Viewer 개선');
    assert.equal(result.rows[0]?.title, 'PLC Monitor & EMO Viewer 개선');
  });
});

describe('parseBulkDetailText — Group', () => {
  it('14. 그룹 + 여러 PMS', () => {
    const result = parse(`Power Saving Mode 관련
PMS #3546 Power Saving Mode 구현
PMS #4198 Power Saving Mode State 변경 안됨`);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0]?.group, 'Power Saving Mode 관련');
    assert.equal(result.rows[1]?.group, 'Power Saving Mode 관련');
  });

  it('15. 그룹 + PMS + Description', () => {
    const result = parse(`Detector Calibration 시퀀스 변경 관련
PMS #4045 Detector Cal. Seq 변경
ImageProcessJob 수정`);
    assert.equal(result.rows[0]?.group, 'Detector Calibration 시퀀스 변경 관련');
    assert.equal(result.rows[0]?.desc, 'ImageProcessJob 수정');
  });

  it('16. PMS + 다중 Description (Alarm)', () => {
    const result = parse(`PMS #4074 Indexer Load/Unload 시 Timeout 기능 적용
Alarm ID: 90053
Alarm Text: load/unload sequence failed. Indexer wait timeout`);
    assert.match(result.rows[0]?.desc ?? '', /Alarm ID: 90053/);
    assert.match(result.rows[0]?.desc ?? '', /Alarm Text/);
  });

  it('17. 연관 PMS 구조', () => {
    const result = parse(`PMS #3622 PLC Monitor & EMO Viewer 개선
연관 PMS
PMS #3798 PLC Monitor 구현 요청`);
    const related = findByRef(result.rows, '3798');
    assert.equal(related?.relationType, 'related-pms');
    assert.equal(related?.parentRef, 'PMS #3622');
  });

  it('18. 연관 PMS 다음 첫 PMS만 related', () => {
    const result = parse(`PMS #3622 PLC Monitor 개선
연관 PMS
PMS #3798 PLC Monitor 구현
PMS #3007 Recipe 구분`);
    assert.equal(findByRef(result.rows, '3798')?.relationType, 'related-pms');
    assert.equal(findByRef(result.rows, '3007')?.relationType, 'normal');
  });

  it('19. 그룹 제목 연속', () => {
    const result = parse(`Power Saving Mode 관련
Tip Width X/Y 구분 관련
PMS #3202 Tip Char`);
    assert.equal(result.rows[0]?.group, 'Tip Width X/Y 구분 관련');
  });

  it('20. 그룹 제목 뒤 PMS 없음', () => {
    const result = parse('Power Saving Mode 관련');
    assert.equal(result.rows.length, 0);
    assert.equal(result.summary.groupTitleCount, 1);
  });

  it('21. Description 중간 "관련" — 그룹 아님', () => {
    const result = parse(`PMS #4100 Power Saving Mode 관련 기능 개선
세부 설명`);
    assert.equal(result.summary.groupTitleCount, 0);
    assert.equal(result.rows[0]?.desc, '세부 설명');
  });

  it('22. Group 오분류 방지 — Recipe desc', () => {
    const result = parse(`PMS #1742 Recipe 저장 기능 구현
측정 결과 폴더\\Debug 내 Recipe 저장
PMS #4074 Indexer Timeout`);
    const recipe = findByRef(result.rows, '1742');
    assert.equal(recipe?.desc, '측정 결과 폴더\\Debug 내 Recipe 저장');
    assert.notEqual(recipe?.group, '측정 결과 폴더\\Debug 내 Recipe 저장');
  });

  it('23. 그룹 전환 시 이전 PMS 내용 누수 없음', () => {
    const result = parse(`PMS #4552 CIM 통신 안정화 개선
Power Saving Mode 관련
PMS #3546 Power Saving Mode 구현`);
    const first = findByRef(result.rows, '4552');
    const second = findByRef(result.rows, '3546');
    assert.equal(first?.group, undefined);
    assert.equal(second?.group, 'Power Saving Mode 관련');
    assert.equal(first?.desc, '');
  });
});

describe('duplicate ref', () => {
  it('24. 기존 Reference 중복 경고', () => {
    const warnings = findDuplicateRefWarnings(
      [{ ref: 'PMS #4045', category: IMPROVEMENT, title: 'a', desc: '' }],
      [{ ref: 'PMS #4045', category: IMPROVEMENT, title: 'b', desc: '' }]
    );
    assert.equal(warnings[0]?.code, 'duplicate-ref');
  });

  it('25. 동일 PMS 번호 여러 그룹', () => {
    const result = parse(OUTLOOK_RELEASE_NOTE_FIXTURE);
    const matches = result.rows.filter((row) => row.ref === 'PMS #3546');
    assert.ok(matches.length >= 2);
  });
});

describe('applyGroupNameToRows', () => {
  const rows = parse(`Power Saving Mode 관련
PMS #3546 Power Saving Mode 구현`).rows;

  it('26. desc-prefix', () => {
    const applied = applyGroupNameToRows(rows, 'desc-prefix');
    assert.equal(applied[0]?.desc, '[Power Saving Mode 관련]');
  });

  it('27. item-prefix', () => {
    const applied = applyGroupNameToRows(rows, 'item-prefix');
    assert.equal(applied[0]?.title, '[Power Saving Mode 관련] Power Saving Mode 구현');
  });

  it('28. none — 원본 보존', () => {
    const applied = applyGroupNameToRows(rows, 'none');
    assert.equal(applied[0]?.desc, '');
    assert.equal(applied[0]?.title, 'Power Saving Mode 구현');
  });
});

describe('SIMPLE_BULK_FIXTURE', () => {
  it('29. 3개 PMS 파싱', () => {
    const result = parse(SIMPLE_BULK_FIXTURE);
    assert.equal(result.summary.pmsCount, 3);
    assert.equal(findByRef(result.rows, '4705')?.ref, 'PMS #4705, #4711');
  });
});

describe('OUTLOOK_RELEASE_NOTE_FIXTURE', () => {
  const result = parse(OUTLOOK_RELEASE_NOTE_FIXTURE);

  it('30. PMS #1742 + desc', () => {
    const row = findByRef(result.rows, '1742');
    assert.equal(row?.desc, '측정 결과 폴더\\Debug 내 Recipe 저장');
  });

  it('31. PMS #4074 + Alarm', () => {
    const row = findByRef(result.rows, '4074');
    assert.match(row?.desc ?? '', /Alarm ID: 90053/);
    assert.match(row?.desc ?? '', /Alarm Text/);
  });

  it('32. PMS #4045 + Group + desc', () => {
    const row = findByRef(result.rows, '4045');
    assert.equal(row?.group, 'Detector Calibration 시퀀스 변경 관련');
    assert.match(row?.desc ?? '', /ImageProcessJob/);
  });

  it('33. PMS #4705,#4711', () => {
    const row = findByRef(result.rows, '4705');
    assert.equal(row?.ref, 'PMS #4705, #4711');
    assert.match(row?.desc ?? '', /TipPositioningJob/);
  });

  it('34. Power Saving Mode 그룹', () => {
    assert.ok(result.rows.some((row) => row.group === 'Power Saving Mode 관련'));
  });

  it('35. 연관 PMS parentRef', () => {
    const row = findByRef(result.rows, '3798');
    assert.equal(row?.parentRef, 'PMS #3622');
  });

  it('36. 전체 Fixture 최소 PMS 수', () => {
    assert.ok(result.summary.pmsCount >= 10);
  });
});

describe('helpers', () => {
  it('extractPmsNumbers 정렬', () => {
    assert.deepEqual(extractPmsNumbers('PMS #4711, #4705'), [4705, 4711]);
  });

  it('refsHaveSamePmsNumbers', () => {
    assert.equal(refsHaveSamePmsNumbers('PMS #4045', 'PMS #4045'), true);
    assert.equal(refsHaveSamePmsNumbers('PMS #4045', 'PMS #4046'), false);
  });

  it('isExplicitGroupTitle', () => {
    assert.equal(isExplicitGroupTitle('Power Saving Mode 관련'), true);
    assert.equal(isExplicitGroupTitle('Power Saving Mode 관련 기능'), false);
  });

  it('toDetailRows metadata 제거', () => {
    const rows = parse(`PMS #3622 PLC Monitor
연관 PMS
PMS #3798 PLC Monitor 구현`).rows;
    const detail = toDetailRows(rows, 'none')[1];
    assert.deepEqual(Object.keys(detail).sort(), ['category', 'desc', 'ref', 'title']);
    assert.equal(detail.ref, 'PMS #3798');
  });
});

describe('dash bullet', () => {
  it('37. - PMS bullet', () => {
    const result = parse('- PMS #4045 Detector Cal');
    assert.equal(result.rows[0]?.ref, 'PMS #4045');
  });
});
