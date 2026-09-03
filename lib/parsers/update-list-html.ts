import * as cheerio from 'cheerio';
import { parseVersionRange } from '@/lib/version';
import type {
  ParsedDocument,
  ParsedHeader,
  ParsedItem,
  ParsedImprovement,
  ParsedAlarm,
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

/**
 * 신 양식(Update Report)의 헤더 폴백.
 *
 * 구 양식은 .meta-grid 에 라벨별 칸이 있지만, 신 양식은 한 줄로 뭉쳐 있다:
 *   <h1>LGD P9 SW Update 적용 내역 및 검증</h1>
 *   <div class="sub">NX-TSH1518 · XEA Dev4027 → Dev4338 · XEService Dev1785 → Dev2037</div>
 *
 * '·' 로 끊어 라벨이 붙은 조각을 찾는다. 사이트는 h1 앞부분에서 가져온다.
 */
function headerFromTitleLine($: cheerio.CheerioAPI): {
  site: string | null;
  model: string | null;
  xea: string;
  xes: string;
} {
  const h1 = tidy($('header h1').first().text() || $('h1').first().text());
  const sub = tidy($('header .sub').first().text() || $('.sub').first().text());

  // 'LGD P9 SW Update 적용 내역 및 검증' -> 'LGD P9'
  const siteMatch = h1.match(/^([A-Z]{2,4}\s?[A-Z]?\d{1,2})\b/);

  const parts = sub.split(/\s*[·|]\s*/).map(tidy).filter(Boolean);
  const labelled = (label: string) =>
    parts.find((x) => x.toUpperCase().startsWith(label.toUpperCase())) ?? '';
  const strip = (x: string, label: string) =>
    tidy(x.slice(label.length));

  const xeaPart = labelled('XEA');
  const xesPart = labelled('XEService');

  return {
    site: siteMatch ? siteMatch[1] : null,
    // 라벨이 붙지 않은 첫 조각을 모델로 본다 (NX-TSH1518).
    model: parts.find((x) => !/^(XEA|XEService|XES|CIM)\b/i.test(x)) ?? null,
    xea: xeaPart ? strip(xeaPart, 'XEA') : '',
    xes: xesPart ? strip(xesPart, 'XEService') : '',
  };
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

  // 구 양식은 .grp, 신 양식은 .grpx 를 쓴다. 둘 다 받는다.
  item.find('.grp, .grpx').each((_, el) => {
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

  // 신 양식의 검증 블록. 개선 내용은 아니지만 같은 항목에 속하므로 함께 보관해
  // 본문 검색에 걸리게 한다. 원문은 raw_html 에 그대로 남는다.
  const verify: string[] = [];
  item.find('.ver').each((_, el) => {
    const box = $(el);
    box.find('dl').each((_, dl) => {
      const rows = $(dl).children();
      let label = '';
      rows.each((_, node) => {
        const tag = (node as { tagName?: string }).tagName?.toLowerCase();
        const text = tidy($(node).text());
        if (tag === 'dt') label = text;
        else if (tag === 'dd' && text) verify.push(label ? `${label}: ${text}` : text);
      });
    });
    box.find('.ck label').each((_, label) => {
      const text = tidy($(label).text());
      if (text) verify.push(`확인: ${text}`);
    });
  });
  if (verify.length) groups.push({ component: 'verify', lines: verify });

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
  const titleLine = equipmentCell ? null : headerFromTitleLine($);

  if (equipmentCell) {
    const [site, ...rest] = equipmentCell.split('/');
    header.site = tidy(site) || null;
    header.model = tidy(rest.join('/')) || null;
  } else if (titleLine?.site || titleLine?.model) {
    header.site = titleLine.site;
    header.model = titleLine.model;
  } else {
    warnings.push({ field: 'site', message: '헤더에서 설비 정보를 찾지 못했습니다.' });
  }

  // 문서에 EQ 번호가 없다. 구조적 한계이므로 항상 경고한다.
  warnings.push({
    field: 'equipment',
    message: '문서에 설비 번호(EQ01 등)가 없습니다. 직접 선택해주세요.',
  });

  header.author = metaValue($, '작성') || null;

  const xea = parseVersionRange(metaValue($, 'XEA') || titleLine?.xea || '');
  header.xeaFromRaw = xea.fromRaw;
  header.xeaFromBuild = xea.fromBuild;
  header.xeaToRaw = xea.toRaw;
  header.xeaToBuild = xea.toBuild;
  xea.warnings.forEach((m) => warnings.push({ field: 'xea', message: m }));

  // 문서는 'XEService' 라고 쓰지만 우리 모델은 XES 로 부른다.
  const xes = parseVersionRange(metaValue($, 'XEService') || titleLine?.xes || '');
  header.xesFromRaw = xes.fromRaw;
  header.xesFromBuild = xes.fromBuild;
  header.xesToRaw = xes.toRaw;
  header.xesToBuild = xes.toBuild;
  xes.warnings.forEach((m) => warnings.push({ field: 'xes', message: m }));

  // --- 배지 범례 ---
  // 배지 의미를 코드에 박지 않는다. 문서가 섹션 0에서 스스로 정의한다.
  // 구 양식은 #s0 안의 div 행, 신 양식은 nav.toc 안의 span 행이다.
  // 표식도 .chip 이거나 .dot/.mine 이라 특정 클래스 이름에 기대지 않는다.
  $('.legend').find('div, span').each((_, el) => {
    const row = $(el);
    const marker = row.children('.chip, .dot, i, span[class]').first();
    const cls = (marker.attr('class') ?? '')
      .split(/\s+/)
      .filter((c) => c && c !== 'chip' && c !== 'dot')[0];
    if (!cls) return;
    const clone = row.clone();
    clone.children('.chip, .dot, i').remove();
    const label = tidy(clone.text());
    if (label && !legend[cls]) legend[cls] = label;
  });

  // --- 섹션과 항목 ---
  const items: ParsedItem[] = [];

  // 구 양식은 <section id="s1">, 신 양식은 <section><h2 class="s" id="s1">.
  // 둘 다 잡으려면 section 을 전부 훑고 그 안의 h2.s 로 판단해야 한다.
  $('section').each((_, sectionEl) => {
    const section = $(sectionEl);
    const heading = section.find('h2.s').first();
    if (!heading.length) return;

    const hasSectionId = /^s\d+$/.test(section.attr('id') ?? '');
    const hasHeadingId = /^s\d+$/.test(heading.attr('id') ?? '');
    if (!hasSectionId && !hasHeadingId) return;

    const sectionNo = Number(tidy(heading.find('.n').first().text()));

    // 섹션 0은 표기 안내다. 항목이 아니다.
    if (!Number.isFinite(sectionNo) || sectionNo === 0) return;

    const headingClone = heading.clone();
    headingClone.find('.n').remove();
    const sectionName = tidy(headingClone.text());

    section.find('.item').each((_, itemEl) => {
      const item = $(itemEl);
      // 구 양식은 <h3 class="s" id="p4552">, 신 양식은 <div class="item" id="p4900"><h4>.
      const h3 = item.find('h3.s').first();
      const heading4 = h3.length ? h3 : item.find('h4').first();

      const numbers = pmsNumbersFrom($, heading4);
      // 앵커는 헤딩(구) 또는 항목 자체(신)에 붙는다.
      const anchorId =
        heading4.attr('id') ?? item.attr('id') ?? `s${sectionNo}-${items.length}`;

      const phenClone = item.find('.phen').first().clone();
      phenClone.find('b').remove();
      const phenomenon = tidy(phenClone.text());

      const improvements = improvementsFrom($, item);

      // 배지의 원시 클래스와, 그 배지가 스스로 달고 있는 라벨을 함께 모은다.
      const chipInfo = heading4
        .find('.chip')
        .map((_, chip) => {
          const cls = (($(chip).attr('class') ?? '')
            .split(/\s+/)
            .filter((c) => c && c !== 'chip'))[0];
          return cls ? { cls, text: tidy($(chip).text()) } : null;
        })
        .get()
        .filter(Boolean) as { cls: string; text: string }[];

      const rawFlags = chipInfo.map((c) => c.cls);

      // 의미는 문서가 정의한다 — 코드에 클래스 이름을 박지 않는다.
      // 구 양식은 범례가 뜻을 갖고(<span class="chip a5">A5</span> + 범례),
      // 신 양식은 배지가 스스로 뜻을 단다(<span class="chip req">요청건</span>).
      // 신 양식 범례는 항목과 다른 클래스(mine vs req)를 쓰므로 범례만으로는 끊긴다.
      const meaningOf = (c: { cls: string; text: string }) => legend[c.cls] || c.text;

      const flags = [...rawFlags];
      if (chipInfo.some((c) => meaningOf(c).includes('미적용'))) {
        flags.push('not_applied');
      }
      if (chipInfo.some((c) => meaningOf(c).includes('요청'))) {
        flags.push('site_requested');
      }

      const title = headingTitle($, heading4);

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
  // --- 신규 Alarm 표 ---
  // .item 이 아니라 table 이다. 알람 ID 는 .pill 에 들어 있다.
  const alarms: ParsedAlarm[] = [];

  $('section table tr').each((_, rowEl) => {
    const row = $(rowEl);
    if (row.find('th').length) return; // 헤더 행

    const alarmId = tidy(row.find('.pill').first().text());
    if (!/^\d+$/.test(alarmId)) return;

    const cells = row.find('td');
    // <br> 로 나뉜 텍스트를 공백으로 연결한다. improvementsFrom 과 같은 패턴.
    const html = cells.eq(1).html() ?? '';
    const textParts: string[] = [];
    html.split(/<br\s*\/?>/i).forEach((part) => {
      const text = tidy($.load(`<span>${part}</span>`)('span').text());
      if (text) textParts.push(text);
    });
    const text = textParts.join(' ');

    const href = cells.eq(2).find('a.pms').attr('href') ?? '';
    const match = href.match(/(\d+)\s*$/);

    alarms.push({ alarmId, text, pmsNo: match ? Number(match[1]) : null });
  });

  // 항목 마크업은 있는데 하나도 수집하지 못했다면 양식이 바뀐 것이다.
  // 이 경고가 없으면 18건을 통째로 놓쳐도 화면에 아무 표시가 남지 않는다.
  const itemMarkupCount = $('.item').length;
  if (itemMarkupCount > 0 && items.length === 0) {
    warnings.push({
      field: 'items',
      message:
        `문서에 항목 마크업이 ${itemMarkupCount}개 있는데 하나도 읽지 못했습니다. ` +
        '문서 양식이 바뀌었을 수 있습니다.',
    });
  }

  return { header, legend, items, alarms, warnings };
}
