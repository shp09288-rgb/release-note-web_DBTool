import * as cheerio from 'cheerio';
import { parseVersionRange } from '@/lib/version';
import type {
  ParsedDocument,
  ParsedHeader,
  ParseWarning,
} from '@/lib/parsers/types';

/** 공백을 하나로 접고 앞뒤를 자른다. HTML에서 뽑은 텍스트는 줄바꿈이 지저분하다. */
function tidy(value: string | undefined | null): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function emptyHeader(): ParsedHeader {
  return {
    site: null,
    equipment: null,
    model: null,
    author: null,
    xeaFromRaw: '', xeaFromBuild: null, xeaToRaw: '', xeaToBuild: null,
    xesFromRaw: '', xesFromBuild: null, xesToRaw: '', xesToBuild: null,
  };
}

/**
 * .meta-grid 의 칸 하나를 라벨로 찾아 값만 돌려준다.
 * 마크업이 <div class="m"><b>설비</b>SDC A5 / NX-TSH2225 #1</div> 형태다.
 */
function metaValue($: cheerio.CheerioAPI, label: string): string {
  let found = '';
  $('.meta-grid .m').each((_, el) => {
    const node = $(el);
    if (tidy(node.find('b').first().text()) === label) {
      const clone = node.clone();
      clone.find('b').remove();
      found = tidy(clone.text());
    }
  });
  return found;
}

export function parseUpdateListHtml(html: string): ParsedDocument {
  const warnings: ParseWarning[] = [];
  const header = emptyHeader();
  const legend: Record<string, string> = {};

  const source = String(html ?? '');
  if (!source.trim()) {
    warnings.push({ field: 'document', message: '빈 문서입니다.' });
    return { header, legend, items: [], alarms: [], warnings };
  }

  const $ = cheerio.load(source);

  // --- 헤더 ---
  const equipmentCell = metaValue($, '설비');
  if (equipmentCell) {
    const [site, ...rest] = equipmentCell.split('/');
    header.site = tidy(site) || null;
    header.model = tidy(rest.join('/')) || null;
  } else {
    warnings.push({ field: 'site', message: '헤더에서 설비 칸을 찾지 못했습니다.' });
  }

  // 문서에 EQ 번호가 없다. 구조적 한계이므로 항상 경고한다.
  warnings.push({
    field: 'equipment',
    message: '문서에 설비 번호(EQ01 등)가 없습니다. 직접 선택해주세요.',
  });

  header.author = metaValue($, '작성') || null;

  const xea = parseVersionRange(metaValue($, 'XEA'));
  header.xeaFromRaw = xea.fromRaw;
  header.xeaFromBuild = xea.fromBuild;
  header.xeaToRaw = xea.toRaw;
  header.xeaToBuild = xea.toBuild;
  xea.warnings.forEach((m) => warnings.push({ field: 'xea', message: m }));

  // 문서는 'XEService' 라고 쓰지만 우리 모델은 XES 로 부른다.
  const xes = parseVersionRange(metaValue($, 'XEService'));
  header.xesFromRaw = xes.fromRaw;
  header.xesFromBuild = xes.fromBuild;
  header.xesToRaw = xes.toRaw;
  header.xesToBuild = xes.toBuild;
  xes.warnings.forEach((m) => warnings.push({ field: 'xes', message: m }));

  // --- 배지 범례 ---
  // 배지 의미를 코드에 박지 않는다. 문서가 섹션 0에서 스스로 정의한다.
  $('#s0 .legend div').each((_, el) => {
    const row = $(el);
    const chip = row.find('.chip').first();
    const cls = (chip.attr('class') ?? '')
      .split(/\s+/)
      .filter((c) => c && c !== 'chip')[0];
    if (!cls) return;
    const clone = row.clone();
    clone.find('.chip').remove();
    legend[cls] = tidy(clone.text());
  });

  return { header, legend, items: [], alarms: [], warnings };
}
