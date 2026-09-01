import * as cheerio from 'cheerio';
import { parseVersionRange } from '@/lib/version';
import type {
  ParsedDocument,
  ParsedHeader,
  ParsedItem,
  ParsedImprovement,
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

/** '#4552 CIM 불안정' 같은 헤딩에서 링크·배지를 뺀 순수 제목만 남긴다. */
function headingTitle($: cheerio.CheerioAPI, heading: cheerio.Cheerio<any>): string {
  const clone = heading.clone();
  clone.find('a.pms, .chip').remove();
  return tidy(clone.text());
}

/** href 의 마지막 숫자가 PMS 번호의 정본이다. 본문 텍스트보다 신뢰할 수 있다. */
function pmsNumbersFrom($: cheerio.CheerioAPI, heading: cheerio.Cheerio<any>): number[] {
  const numbers: number[] = [];
  heading.find('a.pms').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const match = href.match(/(\d+)\s*$/);
    if (match) numbers.push(Number(match[1]));
  });
  return numbers;
}

/**
 * .grp.xea / .grp.xes 다음에 오는 ul 을 그 컴포넌트의 개선 목록으로 묶는다.
 * 마크업이 중첩이 아니라 형제 나열이라 nextAll 로 훑어야 한다.
 */
function improvementsFrom(
  $: cheerio.CheerioAPI,
  item: cheerio.Cheerio<any>
): ParsedImprovement[] {
  const groups: ParsedImprovement[] = [];

  item.find('.grp').each((_, el) => {
    const node = $(el);
    const classes = (node.attr('class') ?? '').split(/\s+/);
    const component = classes.includes('xea')
      ? 'xea'
      : classes.includes('xes')
        ? 'xes'
        : null;
    if (!component) return;

    const list = node.nextAll('ul').first();
    if (!list.length) return;

    const lines: string[] = [];
    list.children('li').each((_, li) => {
      // <br> 로 나뉜 한 <li> 안의 여러 줄도 각각 별도 라인으로 센다.
      const html = $(li).html() ?? '';
      html.split(/<br\s*\/?>/i).forEach((part) => {
        const text = tidy($.load(`<span>${part}</span>`)('span').text());
        if (text) lines.push(text);
      });
    });

    if (lines.length) groups.push({ component, lines });
  });

  return groups;
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

  // --- 섹션과 항목 ---
  const items: ParsedItem[] = [];

  $('section[id^="s"]').each((_, sectionEl) => {
    const section = $(sectionEl);
    const heading = section.find('h2.s').first();
    const sectionNo = Number(tidy(heading.find('.n').first().text()));

    // 섹션 0은 표기 안내다. 항목이 아니다.
    if (!Number.isFinite(sectionNo) || sectionNo === 0) return;

    const headingClone = heading.clone();
    headingClone.find('.n').remove();
    const sectionName = tidy(headingClone.text());

    section.find('.item').each((_, itemEl) => {
      const item = $(itemEl);
      const h3 = item.find('h3.s').first();

      const numbers = pmsNumbersFrom($, h3);
      const anchorId = h3.attr('id') ?? `s${sectionNo}-${items.length}`;

      const phenClone = item.find('.phen').first().clone();
      phenClone.find('b').remove();
      const phenomenon = tidy(phenClone.text());

      const improvements = improvementsFrom($, item);

      const rawFlags = h3
        .find('.chip')
        .map((_, chip) =>
          (($(chip).attr('class') ?? '').split(/\s+/).filter((c) => c && c !== 'chip'))[0]
        )
        .get()
        .filter(Boolean) as string[];

      // 원시 클래스는 그대로 두고, 의미는 문서의 범례에서 유도해 덧붙인다.
      // 'prev' 라는 이름을 코드에 박으면 다음 문서가 다른 클래스를 쓸 때 깨진다.
      const flags = [...rawFlags];
      if (rawFlags.some((f) => (legend[f] ?? '').includes('미적용'))) {
        flags.push('not_applied');
      }
      if (rawFlags.some((f) => (legend[f] ?? '').includes('요청'))) {
        flags.push('site_requested');
      }

      const title = headingTitle($, h3);

      items.push({
        pmsNo: numbers[0] ?? null,
        pmsExtra: numbers.slice(1),
        anchorId,
        section: sectionName,
        sectionNo,
        title,
        phenomenon,
        improvements,
        flags,
        bodyText: [
          title,
          phenomenon,
          ...improvements.flatMap((g) => g.lines),
        ]
          .filter(Boolean)
          .join('\n'),
        sortOrder: items.length,
      });
    });
  });

  return { header, legend, items, alarms: [], warnings };
}
