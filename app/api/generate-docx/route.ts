import JSZip from 'jszip';

interface DetailRow {
  ref: string;
  category: string;
  title: string;
  desc: string;
}

interface NoteRow {
  icon: '!' | 'i';
  text: string;
}

interface HistoryRow {
  date: string;
  xea: string;
  xes: string;
  cim: string;
  summary: string;
}

const PT10 = 18; // 9pt
const PT11 = 22; // 11pt
const PT12 = 24; // 12pt
const PT14 = 28; // 14pt
const PT20 = 40; // 20pt

const NAVY = '1B3A6B';
const NAVYL = '2E5FA3';
const ACC = '4472C4';
const GHEAD = 'D9E1F2';
const GALT = 'F2F4FB';
const WHITE = 'FFFFFF';
const BLACK = '000000';
const RED = 'C00000';
const AMBER = 'ED7D31';
const GREEN_D = '375623';
const PURP = '7030A0';
const BORDER = 'AAAAAA';
const FONT = 'Arial';

function xe(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function splitLines(s: unknown) {
  return String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((v) => v.trim())
    .filter(Boolean);
}

function rpr({
  bold,
  color,
  size = PT10,
  font = FONT,
}: {
  bold?: boolean;
  color?: string;
  size?: number;
  font?: string;
} = {}) {
  return `<w:rPr>
    ${bold ? '<w:b/><w:bCs/>' : ''}
    ${color ? `<w:color w:val="${color}"/>` : ''}
    <w:sz w:val="${size}"/><w:szCs w:val="${size}"/>
    <w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>
  </w:rPr>`;
}

function run(
  text: string,
  opts: {
    bold?: boolean;
    color?: string;
    size?: number;
    font?: string;
  } = {}
) {
  return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${xe(text)}</w:t></w:r>`;
}

function para(
  children: string,
  {
    align,
    before = 60,
    after = 60,
    indL,
  }: {
    align?: 'left' | 'center' | 'right';
    before?: number;
    after?: number;
    indL?: number;
  } = {}
) {
  return `<w:p>
    <w:pPr>
      ${align ? `<w:jc w:val="${align}"/>` : ''}
      <w:spacing w:before="${before}" w:after="${after}" w:line="320"/>
      ${indL ? `<w:ind w:left="${indL}"/>` : ''}
      <w:rPr>
        <w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>
        <w:sz w:val="${PT10}"/><w:szCs w:val="${PT10}"/>
      </w:rPr>
    </w:pPr>
    ${children}
  </w:p>`;
}

function bdr(c = BORDER) {
  return `<w:tcBorders>
    <w:top w:val="single" w:sz="4" w:space="0" w:color="${c}"/>
    <w:left w:val="single" w:sz="4" w:space="0" w:color="${c}"/>
    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${c}"/>
    <w:right w:val="single" w:sz="4" w:space="0" w:color="${c}"/>
  </w:tcBorders>`;
}

function tcPr(
  w: number,
  fill?: string,
  span?: number,
  {
    top = 140,
    left = 160,
    bottom = 140,
    right = 160,
  }: {
    top?: number;
    left?: number;
    bottom?: number;
    right?: number;
  } = {}
) {
  return `<w:tcPr>
    <w:tcW w:w="${w}" w:type="dxa"/>
    ${span ? `<w:gridSpan w:val="${span}"/>` : ''}
    <w:shd w:val="clear" w:color="auto" w:fill="${fill || WHITE}"/>
    ${bdr(BORDER)}
    <w:tcMar>
      <w:top w:w="${top}" w:type="dxa"/>
      <w:left w:w="${left}" w:type="dxa"/>
      <w:bottom w:w="${bottom}" w:type="dxa"/>
      <w:right w:w="${right}" w:type="dxa"/>
    </w:tcMar>
    <w:vAlign w:val="center"/>
  </w:tcPr>`;
}

function tc(
  w: number,
  fill: string | undefined,
  children: string,
  span?: number,
  opts?: { top?: number; left?: number; bottom?: number; right?: number }
) {
  return `<w:tc>${tcPr(w, fill, span, opts)}${children}</w:tc>`;
}

function tr(cells: string) {
  return `<w:tr>${cells}</w:tr>`;
}

function tblXml(colWidths: number[], rows: string) {
  const grid = colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('');
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:type="dxa" w:w="10466"/>
      <w:tblLayout w:type="fixed"/>
      <w:tblInd w:w="0" w:type="dxa"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="${BORDER}"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="${BORDER}"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="${BORDER}"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="${BORDER}"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="${BORDER}"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="${BORDER}"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tblGrid>${grid}</w:tblGrid>
    ${rows}
  </w:tbl>`;
}

function secTitle(text: string) {
  return `<w:p>
    <w:pPr>
      <w:spacing w:before="240" w:after="80"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="8" w:space="1" w:color="${NAVY}"/>
      </w:pBdr>
      <w:rPr>
        <w:b/><w:bCs/>
        <w:color w:val="${NAVY}"/>
        <w:sz w:val="${PT12}"/><w:szCs w:val="${PT12}"/>
        <w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>
      </w:rPr>
    </w:pPr>
    ${run(text, { bold: true, color: NAVY, size: PT12 })}
  </w:p>`;
}

function spacer() {
  return para(run(''), { before: 40, after: 20 });
}

function catColor(c: string) {
  return c === 'New Feature'
    ? ACC
    : c === 'Test Version'
    ? PURP
    : c === 'Improvement'
    ? '00703C'
    : RED;
}

function buildHeader(data: {
  site: string;
  date: string;
  xeaBefore: string;
  xeaAfter: string;
  xesBefore: string;
  xesAfter: string;
  cimVer?: string;
}) {
  const CW = [3131, 7335];

  return tblXml(
    CW,
    [
      tr(
        tc(
          10466,
          NAVY,
          para(run('SW Release Note', { bold: true, color: WHITE, size: PT20 }), {
            align: 'center',
            before: 180,
            after: 30,
          }) +
            para(run('Park Systems Corporation', { color: GHEAD, size: PT10 }), {
              align: 'center',
              before: 0,
              after: 100,
            }),
          2,
          { top: 120, left: 120, bottom: 120, right: 120 }
        )
      ),

      tr(
        tc(
          CW[0],
          NAVYL,
          para(run('Site', { bold: true, color: WHITE, size: PT10 }), {
            align: 'center',
            before: 40,
            after: 40,
          })
        ) +
          tc(
            CW[1],
            GHEAD,
            para(run(data.site || '-', { size: PT10 }), {
              align: 'left',
              before: 40,
              after: 40,
            })
          )
      ),

      tr(
        tc(
          CW[0],
          NAVYL,
          para(run('Release Date', { bold: true, color: WHITE, size: PT10 }), {
            align: 'center',
            before: 40,
            after: 40,
          })
        ) +
          tc(
            CW[1],
            GHEAD,
            para(run(data.date || '-', { size: PT10 }), {
              align: 'left',
              before: 40,
              after: 40,
            })
          )
      ),

      tr(
        tc(
          CW[0],
          NAVYL,
          para(run('SW Version (XEA)', { bold: true, color: WHITE, size: PT10 }), {
            align: 'center',
            before: 40,
            after: 40,
          })
        ) +
          tc(
            CW[1],
            GHEAD,
            para(
              run(data.xeaBefore || '-', { size: PT10 }) +
                run('  →  ', { bold: true, color: NAVYL, size: PT10 }) +
                run(data.xeaAfter || '-', { bold: true, color: NAVY, size: PT10 }),
              {
                align: 'left',
                before: 40,
                after: 40,
              }
            )
          )
      ),

      tr(
        tc(
          CW[0],
          NAVYL,
          para(run('SW Version (XES)', { bold: true, color: WHITE, size: PT10 }), {
            align: 'center',
            before: 40,
            after: 40,
          })
        ) +
          tc(
            CW[1],
            GHEAD,
            para(
              run(data.xesBefore || '-', { size: PT10 }) +
                run('  →  ', { bold: true, color: NAVYL, size: PT10 }) +
                run(data.xesAfter || '-', { bold: true, color: NAVY, size: PT10 }),
              {
                align: 'left',
                before: 40,
                after: 40,
              }
            )
          )
      ),

      tr(
        tc(
          CW[0],
          NAVYL,
          para(run('Target System', { bold: true, color: WHITE, size: PT10 }), {
            align: 'center',
            before: 40,
            after: 40,
          })
        ) +
          tc(
            CW[1],
            GHEAD,
            para(
              run(`XEA / XES${data.cimVer ? ' / CIM' : ''}`, { size: PT10 }),
              {
                align: 'left',
                before: 40,
                after: 40,
              }
            )
          )
      ),
    ].join('')
  );
}

function buildOverview(items: string[]) {
  return tblXml(
    [10466],
    [
      tr(
        tc(
          10466,
          NAVY,
          para(run('Release Overview', { bold: true, color: WHITE, size: PT11 }), {
            before: 40,
            after: 40,
          })
        )
      ),
      ...(items.length > 0
        ? items.map((it, i) =>
            tr(
              tc(
                10466,
                i % 2 === 0 ? WHITE : GALT,
                para(
                  run(`${i + 1}.  `, { bold: true, color: NAVY, size: PT10 }) +
                    run(it || '-', { size: PT10 }),
                  { align: 'left', before: 30, after: 30 }
                )
              )
            )
          )
        : [
            tr(
              tc(
                10466,
                WHITE,
                para(run('1.  -', { size: PT10 }), {
                  before: 30,
                  after: 30,
                })
              )
            ),
          ]),
    ].join('')
  );
}

function buildSysDetail(
  label: string,
  items: DetailRow[],
  before: string,
  after: string
) {
  if (!items?.length) return '';

  const CW = [1454, 1677, 3422, 3913];

  const titleRow = tr(
    tc(
      10466,
      NAVY,
      para(
        run(`${label}  `, { bold: true, color: WHITE, size: PT11 }) +
          run(`${before || '-'} → ${after || '-'}`, {
            color: GHEAD,
            size: PT10,
          }),
        { align: 'left', before: 40, after: 40 }
      ),
      4
    )
  );

  const header = tr(
    [
      ['Reference', CW[0]],
      ['Category', CW[1]],
      ['Item', CW[2]],
      ['Description', CW[3]],
    ]
      .map(([text, w]) =>
        tc(
          Number(w),
          NAVYL,
          para(run(String(text), { bold: true, color: WHITE, size: PT10 }), {
            align: 'center',
            before: 40,
            after: 40,
          })
        )
      )
      .join('')
  );

  const rows = items.map((d, i) => {
    const bg = i % 2 === 0 ? WHITE : GALT;
    const descLines = splitLines(d.desc);
    const descBody = descLines.length
      ? descLines
          .map((line) =>
            para(run(line, { size: PT10 }), {
              align: 'left',
              before: 20,
              after: 20,
            })
          )
          .join('')
      : para(run('-', { size: PT10 }), { align: 'left', before: 20, after: 20 });

    return tr(
      [
        tc(
          CW[0],
          bg,
          para(run(d.ref || '-', { color: NAVYL, size: PT10 }), {
            align: 'center',
            before: 20,
            after: 20,
          })
        ),
        tc(
          CW[1],
          bg,
          para(run(d.category || '-', { bold: true, color: catColor(d.category), size: PT10 }), {
            align: 'center',
            before: 20,
            after: 20,
          })
        ),
        tc(
          CW[2],
          bg,
          para(run(d.title || '-', { bold: true, size: PT10 }), {
            align: 'center',
            before: 20,
            after: 20,
          })
        ),
        tc(CW[3], bg, descBody),
      ].join('')
    );
  });

  return tblXml(CW, [titleRow, header, ...rows].join(''));
}

function buildNotes(items: NoteRow[]) {
  return tblXml(
    [10466],
    [
      tr(
        tc(
          10466,
          NAVY,
          para(run('Important Notes', { bold: true, color: WHITE, size: PT11 }), {
            before: 40,
            after: 40,
          })
        )
      ),
      ...(items.length > 0
        ? items.map((n, i) =>
            tr(
              tc(
                10466,
                i % 2 === 0 ? WHITE : GALT,
                splitLines(n.text).length > 0
                  ? splitLines(n.text)
                      .map((line, idx) =>
                        para(
                          (idx === 0
                            ? run(`[${n.icon}]  `, {
                                bold: true,
                                color: n.icon === '!' ? RED : NAVY,
                                size: PT10,
                              })
                            : run('   ', { size: PT10 })) + run(line, { size: PT10 }),
                          { align: 'left', before: 20, after: 20 }
                        )
                      )
                      .join('')
                  : para(run(`[${n.icon}] -`, { size: PT10 }), {
                      align: 'left',
                      before: 20,
                      after: 20,
                    })
              )
            )
          )
        : [
            tr(
              tc(
                10466,
                WHITE,
                para(run('[!] -', { size: PT10 }), {
                  align: 'left',
                  before: 20,
                  after: 20,
                })
              )
            ),
          ]),
    ].join('')
  );
}

function buildHistory(items: HistoryRow[]) {
  // Date | Version | 주요 변경 내용
  const CW = [1360, 2100, 7000];

  const header = tr(
    [
      ['Date', CW[0]],
      ['Version', CW[1]],
      ['주요 변경 내용', CW[2]],
    ]
      .map(([text, w]) =>
        tc(
          Number(w),
          NAVY,
          para(run(String(text), { bold: true, color: WHITE, size: PT10 }), {
            align: 'center',
            before: 40,
            after: 40,
          })
        )
      )
      .join('')
  );

  const rows = items.length
    ? items.map((h, i) => {
        const bg = i === 0 ? GHEAD : i % 2 === 0 ? WHITE : GALT;
        const isTop = i === 0;

        const versionLines: string[] = [];
        if (h.xea && h.xea !== '-') versionLines.push(`XEA ${h.xea}`);
        if (h.xes && h.xes !== '-') versionLines.push(`XES ${h.xes}`);
        if (h.cim && h.cim !== '-') versionLines.push(`CIM ${h.cim}`);

        const versionBody =
          versionLines.length > 0
            ? versionLines
                .map((line) =>
                  para(run(line, { size: PT10, bold: isTop }), {
                    align: 'left',
                    before: 20,
                    after: 20,
                  })
                )
                .join('')
            : para(run('-', { size: PT10, bold: isTop }), {
                align: 'left',
                before: 20,
                after: 20,
              });

        const summaryBody = splitLines(h.summary).length
          ? splitLines(h.summary)
              .map((line) =>
                para(run(line, { size: PT10, bold: isTop }), {
                  align: 'left',
                  before: 20,
                  after: 20,
                })
              )
              .join('')
          : para(run('-', { size: PT10, bold: isTop }), {
              align: 'left',
              before: 20,
              after: 20,
            });

        return tr(
          [
            tc(
              CW[0],
              bg,
              para(run(h.date || '-', { size: PT10, bold: isTop }), {
                align: 'center',
                before: 20,
                after: 20,
              })
            ),
            tc(CW[1], bg, versionBody),
            tc(CW[2], bg, summaryBody),
          ].join('')
        );
      })
    : [
        tr(
          tc(
            10466,
            WHITE,
            para(run('이력 없음', { size: PT10 }), {
              align: 'center',
              before: 20,
              after: 20,
            }),
            3
          )
        ),
      ];

  return tblXml(CW, [header, ...rows].join(''));
}

function buildDocXml(data: {
  site: string;
  equipment: string;
  date: string;
  xeaBefore: string;
  xeaAfter: string;
  xesBefore: string;
  xesAfter: string;
  cimVer?: string;
  overview: string[];
  xeaDetails: DetailRow[];
  xesDetails: DetailRow[];
  testVersions: DetailRow[];
  notes: NoteRow[];
  history: HistoryRow[];
}) {
  const ns =
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  const body = `
    ${buildHeader(data)}
    ${spacer()}${spacer()}
    ${secTitle('1.  Release Overview')}
    ${spacer()}
    ${buildOverview(data.overview)}
    ${spacer()}${spacer()}
    ${secTitle('2.  System Detail')}
    ${spacer()}
    ${
      data.xeaDetails?.length
        ? para(run('2.1  XEA', { bold: true, color: NAVY, size: PT11 }), {
            before: 50,
            after: 50,
          })
        : ''
    }
    ${buildSysDetail('XEA', data.xeaDetails, data.xeaBefore, data.xeaAfter)}
    ${spacer()}
    ${
      data.xesDetails?.length
        ? para(run('2.2  XES', { bold: true, color: NAVY, size: PT11 }), {
            before: 50,
            after: 50,
          })
        : ''
    }
    ${buildSysDetail('XES', data.xesDetails, data.xesBefore, data.xesAfter)}
    ${spacer()}
    ${
      data.testVersions?.length
        ? para(run('2.3  Test Version', { bold: true, color: NAVY, size: PT11 }), {
            before: 50,
            after: 50,
          })
        : ''
    }
    ${buildSysDetail('Test Version', data.testVersions, 'Export', 'Verified')}
    ${spacer()}${spacer()}
    ${secTitle('4.  Important Notes')}
    ${spacer()}
    ${buildNotes(data.notes)}
    ${spacer()}${spacer()}
    ${secTitle('5.  SW Update History')}
    ${spacer()}
    ${buildHistory(data.history)}
    ${spacer()}
    ${para(run('※ 최신 버전이 상단에 표시됩니다.', { color: '888888', size: PT10 }), {
      before: 20,
      after: 20,
    })}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  `;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns}>
  <w:body>${body}</w:body>
</w:document>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/>
        <w:sz w:val="${PT10}"/><w:szCs w:val="${PT10}"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="0"/></w:pPr>
  </w:style>
</w:styles>`;

const SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:defaultTabStop w:val="720"/>
</w:settings>`;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const data = {
      site: String(body.site || '').replace(/_/g, ' '),
      equipment: String(body.equipment || 'EQ'),
      date: String(body.date || '-'),
      xeaBefore: String(body.xeaBefore || '-'),
      xeaAfter: String(body.xeaAfter || '-'),
      xesBefore: String(body.xesBefore || '-'),
      xesAfter: String(body.xesAfter || '-'),
      cimVer: String(body.cimVer || ''),
      overview: Array.isArray(body.overview) ? body.overview : [],
      xeaDetails: Array.isArray(body.xeaDetails) ? body.xeaDetails : [],
      xesDetails: Array.isArray(body.xesDetails) ? body.xesDetails : [],
      testVersions: Array.isArray(body.testVersions) ? body.testVersions : [],
      notes: Array.isArray(body.notes) ? body.notes : [],
      history: Array.isArray(body.history) ? body.history : [],
    };

    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES);
    zip.file('_rels/.rels', RELS);
    zip.file('word/document.xml', buildDocXml(data));
    zip.file('word/_rels/document.xml.rels', WORD_RELS);
    zip.file('word/styles.xml', STYLES);
    zip.file('word/settings.xml', SETTINGS);

    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const today = `${yyyy}-${mm}-${dd}`;
    const safeSite = String(body.site || 'SITE').replace(/\s/g, '_');

    const filename = `${today}_${safeSite}_${body.equipment || 'EQ'}_ReleaseNote.docx`;

    return new Response(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { ok: false, message: 'DOCX 생성 실패' },
      { status: 500 }
    );
  }
}