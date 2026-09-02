# SW 버전 이력 조회 도구 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 릴리즈 노트 작성 도구를, 유관부서가 준 HTML 배포 문서를 파싱해 사이트별 SW 버전 이력을 조회하는 도구로 전환한다.

**Architecture:** 순수 함수 파서(`lib/parsers/`)가 HTML을 객체로 바꾸고, 사람이 미리보기에서 보정한 뒤 Supabase의 `deployments` / `deployment_items`에 저장한다. 조회는 사이트 타임라인과 PMS 역조회 두 축이다. Redmine 캐시는 선택적 보강이며 없어도 도구는 동작한다.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase(Postgres) · cheerio · vitest

**Spec:** `docs/superpowers/specs/2026-09-01-sw-version-history-design.md`

## Global Constraints

- **Next.js 16.2.4.** 학습 데이터의 Next.js와 다르다. 라우트·params 규약을 쓰기 전에 `node_modules/next/dist/docs/`의 해당 가이드를 읽는다. 동적 라우트의 `params`는 **Promise**다 — `const { site } = await params`.
- **비밀키에 `NEXT_PUBLIC_` 을 붙이지 않는다.** `SUPABASE_SERVICE_ROLE_KEY`, `PMS_API_KEY`는 서버 전용. 클라이언트는 항상 `/api/*`를 거친다.
- **API 키·토큰을 어떤 파일에도 커밋하지 않는다.** 이 폴더는 OneDrive 동기화 중이고 git 히스토리에 남는다. `.gitignore`가 `.env*`를 막고 있다.
- **파서는 예외를 던지지 않는다.** 못 읽은 값은 `null` + `warnings[]` 1건.
- **버전 문자열은 원문을 버리지 않는다.** `*_raw`와 `*_build`를 항상 함께 저장한다.
- **경로 별칭은 `@/`** (`tsconfig.json`의 `paths`).
- **구 테이블(`notes` 등)은 Task 18 전까지 DROP하지 않는다.**
- 커밋 메시지는 한 줄 영문 conventional commit. 본문은 필요할 때만.

## 이 계획의 범위 밖

spec에 있으나 이번에 만들지 않는 것. 빠뜨린 게 아니라 미룬 것이다.

- **`raw_html` 재파싱 기능** — spec 1.2가 "파서를 고쳤을 때 재파싱할 수 있다"고
  한 것은 **가능성**의 보장이다. `raw_html`과 `edited_at`을 저장하므로 그때 가서
  스크립트 하나로 할 수 있다. 지금 UI를 만들 이유가 없다.
- **`pg_trgm` 인덱스** — spec 4.1대로 느려지면 그때 단다.
- **RLS 활성화** — 구 스키마와 동일하게 Phase 1(비활성) 유지.

## 픽스처 실측값

`docs/SDC_A5_Update_List.html`. 테스트 기대값은 전부 이 실측에서 나왔다.

| 항목 | 값 |
|---|---|
| `.item` 총 개수 | 34 |
| 섹션별 | s1=2, s2=2, s3=5, s4=8, s5=3, s6=5, s7=5, s8=4 |
| 섹션 이름 | CIM · Feature Align · Tip Check · PMAC · PLC · 측정 / 분석 · UI / 편의 · 안정화 / 성능 |
| PMS 복수 항목 | `p4705`→[4705,4711], `p4727`→[4727,4827], `p3421`→[3421,4488] |
| PMS 없는 항목 | `pjobresult` 1건 |
| `h3` 내 배지 | `chip a5` 8건, `chip prev` 16건 |
| 신규 Alarm | 3건 (20105, 20144, 20158) |
| 헤더 | site `SDC A5`, model `NX-TSH2225 #1`, XEA `Dev3592 → Dev4317`, XES `Dev1609 → Dev2015` |

> [!warning] 문서에 **설비 번호(EQ01)가 없다**
> 헤더의 `설비`는 `SDC A5 / NX-TSH2225 #1`이다. 레거시 데이터는 `equipment='EQ01'`을 쓴다.
> 파서는 `equipment: null` + 경고를 내고, **업로드 미리보기에서 사람이 고른다.**

---

# Phase A — 순수 로직

DB도 Next.js도 없이 테스트되는 부분. 여기가 이 프로젝트의 핵심이다.

---

### Task 1: 테스트 환경 + 버전 정규화

**Files:**
- Create: `vitest.config.ts`
- Create: `lib/version.ts`
- Test: `lib/version.test.ts`
- Modify: `package.json` (devDependencies, scripts)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `parseBuild(raw: string): { raw: string; build: number | null; warning?: string }`
  - `parseVersionRange(raw: string): { fromRaw: string; fromBuild: number | null; toRaw: string; toBuild: number | null; warnings: string[] }`

- [ ] **Step 1: vitest 설치**

```bash
npm install -D vitest
```

- [ ] **Step 2: vitest 설정 파일 작성**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // 우리가 새로 쓰는 테스트만 집는다.
    // lib/note-save.test.ts 와 lib/release-note-bulk-parser.test.ts 는
    // node:test 로 작성된 기존 테스트라 vitest 가 스위트를 못 찾고 실패한다.
    // 둘 다 Task 18 에서 지우는 작성 도구 코드의 테스트다.
    include: [
      'lib/version.test.ts',
      'lib/parsers/**/*.test.ts',
      'lib/pms/**/*.test.ts',
      'lib/queries/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 3: `package.json`에 test 스크립트 추가**

`"scripts"`에 추가 (기존 `import-data`는 Task 18에서 정리한다):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: 실패하는 테스트 작성**

Create `lib/version.test.ts`:

```ts
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
```

- [ ] **Step 5: 테스트가 실패하는지 확인**

Run: `npm test -- lib/version.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/version"`

- [ ] **Step 6: 구현**

Create `lib/version.ts`:

```ts
export type BuildParse = {
  raw: string;
  build: number | null;
  warning?: string;
};

export type VersionRange = {
  fromRaw: string;
  fromBuild: number | null;
  toRaw: string;
  toBuild: number | null;
  warnings: string[];
};

const SEMVER = /\d+\.\d+\.\d+/g;
const BUILD = /(?:Dev\s*)?(\d{2,5})/gi;

/**
 * 빌드 번호 하나를 읽는다.
 *
 * 표기 변종이 많다: '5.2.5 Dev3592', '5.2.5 3271', '5.2.5 Dev 907', 'Dev635'.
 * 접근: 앞의 시맨틱 버전(5.2.5)을 지운 뒤 남은 숫자를 센다.
 * 정확히 하나면 그것이 빌드 번호, 둘 이상이면 오염된 값으로 보고 버린다.
 * 원문은 어떤 경우에도 보존한다.
 */
export function parseBuild(input: string): BuildParse {
  const raw = String(input ?? '').trim();

  if (!raw || raw === '-') {
    return { raw, build: null };
  }

  const stripped = raw.replace(SEMVER, ' ');
  const matches = [...stripped.matchAll(BUILD)].map((m) => Number(m[1]));

  if (matches.length === 0) {
    return { raw, build: null, warning: `빌드 번호를 찾지 못했습니다: "${raw}"` };
  }

  if (matches.length > 1) {
    return {
      raw,
      build: null,
      warning: `한 칸에 빌드 번호가 여러 개입니다: "${raw}"`,
    };
  }

  return { raw, build: matches[0] };
}

/**
 * 'A → B' 형태의 버전 구간을 읽는다.
 * 화살표가 없으면 단일 값으로 보고 to 에만 넣는다 — 레거시 history 행이 그렇다.
 */
export function parseVersionRange(input: string): VersionRange {
  const raw = String(input ?? '').trim().replace(/^\(|\)$/g, '').trim();
  const warnings: string[] = [];

  const parts = raw.split(/\s*(?:→|->)\s*/);

  if (parts.length === 2) {
    const from = parseBuild(parts[0]);
    const to = parseBuild(parts[1]);
    if (from.warning) warnings.push(from.warning);
    if (to.warning) warnings.push(to.warning);
    return {
      fromRaw: from.raw,
      fromBuild: from.build,
      toRaw: to.raw,
      toBuild: to.build,
      warnings,
    };
  }

  const to = parseBuild(raw);
  if (to.warning) warnings.push(to.warning);
  return { fromRaw: '', fromBuild: null, toRaw: to.raw, toBuild: to.build, warnings };
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test -- lib/version.test.ts`
Expected: PASS — 12 tests

- [ ] **Step 8: 커밋**

```bash
git add vitest.config.ts package.json package-lock.json lib/version.ts lib/version.test.ts
git commit -m "feat: add build version parser with vitest setup"
```

---

### Task 2: 파서 — 헤더와 배지 범례

**Files:**
- Create: `lib/parsers/types.ts`
- Create: `lib/parsers/update-list-html.ts`
- Test: `lib/parsers/update-list-html.test.ts`

**Interfaces:**
- Consumes: `parseVersionRange` (Task 1)
- Produces:
  - `parseUpdateListHtml(html: string): ParsedDocument`
  - 타입 `ParsedDocument`, `ParsedHeader`, `ParsedItem`, `ParsedAlarm`, `ParseWarning`, `ParsedImprovement`

- [ ] **Step 1: cheerio 설치**

```bash
npm install cheerio
```

- [ ] **Step 2: 타입 정의**

Create `lib/parsers/types.ts`:

```ts
export type ParseWarning = { field: string; message: string };

export type ParsedImprovement = {
  component: 'xea' | 'xes';
  lines: string[];
};

export type ParsedItem = {
  pmsNo: number | null;
  pmsExtra: number[];
  anchorId: string;
  section: string;
  sectionNo: number;
  title: string;
  phenomenon: string;
  improvements: ParsedImprovement[];
  flags: string[];
  bodyText: string;
  sortOrder: number;
};

export type ParsedAlarm = {
  alarmId: string;
  text: string;
  pmsNo: number | null;
};

export type ParsedHeader = {
  site: string | null;
  /** 문서에 설비 번호가 없다. 항상 null — 사람이 미리보기에서 고른다. */
  equipment: string | null;
  model: string | null;
  author: string | null;
  xeaFromRaw: string;
  xeaFromBuild: number | null;
  xeaToRaw: string;
  xeaToBuild: number | null;
  xesFromRaw: string;
  xesFromBuild: number | null;
  xesToRaw: string;
  xesToBuild: number | null;
};

export type ParsedDocument = {
  header: ParsedHeader;
  /** chip 클래스 -> 문서가 스스로 정의한 라벨. 예: { a5: 'SDC A5 요청 또는 발생 건' } */
  legend: Record<string, string>;
  items: ParsedItem[];
  alarms: ParsedAlarm[];
  warnings: ParseWarning[];
};
```

- [ ] **Step 3: 실패하는 테스트 작성**

Create `lib/parsers/update-list-html.test.ts`:

```ts
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
```

- [ ] **Step 4: 테스트가 실패하는지 확인**

Run: `npm test -- lib/parsers`
Expected: FAIL — `Failed to resolve import "@/lib/parsers/update-list-html"`

- [ ] **Step 5: 헤더·범례 파서 구현**

Create `lib/parsers/update-list-html.ts`:

```ts
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
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- lib/parsers`
Expected: PASS — 헤더 5건, 범례 1건, 견고성 2건 = 8 tests

항목 파싱은 Task 3이다. 이 태스크는 **실패하는 테스트를 남기지 않는다** —
항목을 다루는 테스트는 Task 3에서 함께 추가한다.

- [ ] **Step 7: 커밋**

```bash
git add lib/parsers package.json package-lock.json
git commit -m "feat: parse update-list header and badge legend"
```

---

### Task 3: 파서 — 섹션과 항목

**Files:**
- Modify: `lib/parsers/update-list-html.ts`
- Modify: `lib/parsers/update-list-html.test.ts`

**Interfaces:**
- Consumes: Task 2의 `parseUpdateListHtml`, `tidy`
- Produces: `ParsedDocument.items: ParsedItem[]` 채워진 상태

- [ ] **Step 1: 실패하는 테스트 추가**

`lib/parsers/update-list-html.test.ts` 끝에 추가:

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- lib/parsers`
Expected: FAIL — `expected [] to have a length of 34 but got 0`

- [ ] **Step 3: 항목 파싱 구현**

`lib/parsers/update-list-html.ts`의 import에 `ParsedItem`, `ParsedImprovement`를 추가하고, 파일 안에 헬퍼를 넣는다:

```ts
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

    // <li> 안의 <br> 은 저자가 의도한 줄바꿈이다. 픽스처의 p4552 XES 그룹은
    // <li> 가 3개인데 세 번째가 <br> 로 두 개의 개선 사항을 담고 있다.
    // 쪼개지 않으면 tidy() 가 공백을 접으면서 두 문장이 한 줄로 뒤엉킨다.
    const lines: string[] = [];
    list.children('li').each((_, li) => {
      const html = $(li).html() ?? '';
      for (const part of html.split(/<br\s*\/?>/i)) {
        const text = tidy(cheerio.load(part).root().text());
        if (text) lines.push(text);
      }
    });

    if (lines.length) groups.push({ component, lines });
  });

  return groups;
}
```

그리고 `return { header, legend, items: [], alarms: [], warnings };` 앞에 항목 수집을 넣는다:

```ts
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
```

마지막으로 반환문을 `return { header, legend, items, alarms: [], warnings };` 로 바꾼다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- lib/parsers`
Expected: PASS — 견고성 테스트 3건 포함 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add lib/parsers
git commit -m "feat: parse update-list sections and improvement items"
```

---

### Task 4: 파서 — 신규 Alarm 표

**Files:**
- Modify: `lib/parsers/update-list-html.ts`
- Modify: `lib/parsers/update-list-html.test.ts`

**Interfaces:**
- Consumes: Task 3의 파서
- Produces: `ParsedDocument.alarms: ParsedAlarm[]`

- [ ] **Step 1: 실패하는 테스트 추가**

```ts
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
    expect(alarm.text).toContain('Air Pressure is abnormal');
  });

  it('출처 PMS 번호를 링크에서 읽는다', () => {
    const alarm = doc.alarms.find((a) => a.alarmId === '20158')!;
    expect(alarm.pmsNo).toBe(4881);
  });

  it('헤더 행(th)을 알람으로 세지 않는다', () => {
    expect(doc.alarms.every((a) => /^\d+$/.test(a.alarmId))).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- lib/parsers`
Expected: FAIL — `expected [] to have a length of 3 but got 0`

- [ ] **Step 3: 구현**

`lib/parsers/update-list-html.ts`에 `ParsedAlarm` import를 추가하고, 항목 수집 블록 뒤에 넣는다:

```ts
  // --- 신규 Alarm 표 ---
  // .item 이 아니라 table 이다. 알람 ID 는 .pill 에 들어 있다.
  const alarms: ParsedAlarm[] = [];

  $('section table tr').each((_, rowEl) => {
    const row = $(rowEl);
    if (row.find('th').length) return; // 헤더 행

    const alarmId = tidy(row.find('.pill').first().text());
    if (!/^\d+$/.test(alarmId)) return;

    const cells = row.find('td');
    const text = tidy(cells.eq(1).text());
    const href = cells.eq(2).find('a.pms').attr('href') ?? '';
    const match = href.match(/(\d+)\s*$/);

    alarms.push({ alarmId, text, pmsNo: match ? Number(match[1]) : null });
  });
```

반환문을 `return { header, legend, items, alarms, warnings };` 로 바꾼다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- lib/parsers`
Expected: PASS — 전체 통과

- [ ] **Step 5: 커밋**

```bash
git add lib/parsers
git commit -m "feat: parse new-alarm table from update-list document"
```

---

### Task 5: 레거시 텍스트에서 PMS 번호 추출

**Files:**
- Create: `lib/pms/extract.ts`
- Test: `lib/pms/extract.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `extractPmsNumbers(text: string): number[]`

레거시 요약 90건 중 46건에 `#숫자`가 들어 있다. 이걸 뽑아야 과거 배포도 PMS 역조회에 걸린다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/pms/extract.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractPmsNumbers } from '@/lib/pms/extract';

describe('extractPmsNumbers', () => {
  it('#번호를 뽑는다', () => {
    expect(extractPmsNumbers('PMS #4199 수정 완료')).toEqual([4199]);
  });

  it('# 뒤 공백을 허용한다', () => {
    expect(extractPmsNumbers('# 4199')).toEqual([4199]);
  });

  it('여러 개를 순서대로 뽑고 중복은 한 번만 센다', () => {
    expect(extractPmsNumbers('#4199 그리고 #3887, 다시 #4199')).toEqual([4199, 3887]);
  });

  it('설비 이름의 #1 같은 짧은 번호는 무시한다', () => {
    expect(extractPmsNumbers('NX-TSH2225 #1 설비')).toEqual([]);
  });

  it('여섯 자리 이상은 PMS 번호가 아니다', () => {
    expect(extractPmsNumbers('#123456')).toEqual([]);
  });

  it('빈 입력에 빈 배열을 준다', () => {
    expect(extractPmsNumbers('')).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- lib/pms/extract.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/pms/extract"`

- [ ] **Step 3: 구현**

Create `lib/pms/extract.ts`:

```ts
/**
 * 자유 텍스트에서 PMS 번호를 뽑는다. 레거시 요약에는 링크가 없고 '#4199' 처럼
 * 텍스트로만 적혀 있다.
 *
 * 3~5자리로 제한한다. 'NX-TSH2225 #1' 같은 설비 표기를 PMS 번호로 잘못 잡지
 * 않기 위해서다. 그래도 오탐이 남으므로 호출부가 Redmine 으로 검증한다.
 */
export function extractPmsNumbers(text: string): number[] {
  const source = String(text ?? '');
  const seen = new Set<number>();
  const result: number[] = [];

  for (const match of source.matchAll(/#\s?(\d{3,5})\b/g)) {
    const value = Number(match[1]);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- lib/pms/extract.test.ts`
Expected: PASS — 6 tests

- [ ] **Step 5: 커밋**

```bash
git add lib/pms/extract.ts lib/pms/extract.test.ts
git commit -m "feat: extract PMS numbers from legacy summary text"
```

---

### Task 6: Redmine 클라이언트

**Files:**
- Create: `lib/pms/redmine.ts`
- Test: `lib/pms/redmine.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `parseOriginSite(subject: string): string | null`
  - `pickCustomField(fields: RedmineCustomField[], name: string): string`
  - `fetchIssue(id: number, deps?: { fetch?: typeof fetch }): Promise<PmsIssue | null>`
  - 타입 `PmsIssue`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/pms/redmine.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { parseOriginSite, pickCustomField, fetchIssue } from '@/lib/pms/redmine';

describe('parseOriginSite', () => {
  it('대괄호 접두사에서 사이트를 뽑는다', () => {
    expect(parseOriginSite('[SDC A3] NX-TSH1518 #1 /[PMS] CIM 불안정 건')).toBe('SDC A3');
  });

  it('슬래시로 시작하는 제목에서도 뽑는다', () => {
    expect(
      parseOriginSite('SDC A5 / NX-TSH2225 #1 / 측정 끝난 후 Fatal following error')
    ).toBe('SDC A5');
  });

  it('사이트를 못 찾으면 null', () => {
    expect(parseOriginSite('그냥 제목')).toBeNull();
  });
});

describe('pickCustomField', () => {
  it('이름으로 값을 찾는다', () => {
    const fields = [
      { id: 5, name: 'Software Version', value: 'XEA 5.2.5 D3768' },
      { id: 24, name: 'XEService Version', value: 'XEA 5.2.5 D1609' },
    ];
    expect(pickCustomField(fields, 'Software Version')).toBe('XEA 5.2.5 D3768');
  });

  it('없으면 빈 문자열', () => {
    expect(pickCustomField([], 'Software Version')).toBe('');
  });
});

describe('fetchIssue', () => {
  const issue = {
    issue: {
      id: 4952,
      subject: 'SDC A5 / NX-TSH2225 #1 / Fatal following error',
      status: { name: 'In Progress', is_closed: false },
      tracker: { name: 'SR' },
      priority: { name: 'High' },
      author: { name: '노승범' },
      assigned_to: { name: '이호연' },
      custom_fields: [{ id: 5, name: 'Software Version', value: 'XEA 5.2.5 D3768' }],
      created_on: '2026-08-21T03:00:06Z',
      updated_on: '2026-08-27T01:22:38Z',
      closed_on: null,
    },
  };

  it('이슈를 정규화해 돌려준다', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => issue,
    });
    const result = await fetchIssue(4952, { fetch: fakeFetch as any });
    expect(result?.issueId).toBe(4952);
    expect(result?.status).toBe('In Progress');
    expect(result?.isClosed).toBe(false);
    expect(result?.swVersion).toBe('XEA 5.2.5 D3768');
    expect(result?.originSite).toBe('SDC A5');
  });

  it('404 는 null 을 준다 — 없는 번호는 오탐이므로 버린다', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    expect(await fetchIssue(999, { fetch: fakeFetch as any })).toBeNull();
  });

  it('네트워크 오류에도 예외를 던지지 않는다', async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await fetchIssue(4952, { fetch: fakeFetch as any })).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- lib/pms/redmine.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/pms/redmine"`

- [ ] **Step 3: 구현**

Create `lib/pms/redmine.ts`:

```ts
export type RedmineCustomField = { id: number; name: string; value: unknown };

export type PmsIssue = {
  issueId: number;
  subject: string;
  status: string;
  isClosed: boolean;
  tracker: string;
  priority: string;
  author: string;
  assignee: string;
  swVersion: string;
  xesVersion: string;
  /** 제목에서 뽑은 발생 사이트. 배포된 사이트와 다를 수 있다 — 그게 이 필드의 값이다. */
  originSite: string | null;
  createdOn: string | null;
  updatedOn: string | null;
  closedOn: string | null;
};

// 사이트 표기는 '벤더 + 공백 + 팹' 이다: SDC A5, SDC A3, LGD AP3.
//
// 세 가지 가드가 전부 필요하다.
//  (?<![A-Za-z0-9-])  장비 모델명 안쪽을 물지 않게 한다. 이게 없으면
//                     'NX-TSH1518' 에서 'TSH15' 를 사이트로 착각한다.
//  \s + [A-Z]{1,2}    'LGD AP3' 를 통째로 잡는다. [A-Z]? 로는 'AP3' 만 잡혀
//                     LGD 사이트 3곳이 전부 잘린다.
//  (?!\d)             긴 숫자열을 잘라 가짜 팹 번호를 만들지 않게 한다.
const SITE = /(?<![A-Za-z0-9-])([A-Z]{2,4}\s[A-Z]{1,2}\d{1,2})(?!\d)/;

/**
 * Redmine 제목에서 이슈가 발생한 사이트를 뽑는다.
 *
 * '#4552' 는 SDC A5 배포 문서의 항목이지만 제목은 '[SDC A3] ...' 이다.
 * A3 에서 제기된 수정이 A5 에 들어갔다는 뜻이고, 문서만 봐서는 알 수 없다.
 */
export function parseOriginSite(subject: string): string | null {
  const source = String(subject ?? '');

  const bracket = source.match(/^\s*\[([^\]]+)\]/);
  if (bracket) {
    const inner = bracket[1].match(SITE);
    if (inner) return inner[1].replace(/\s+/g, ' ').trim();
  }

  const head = source.split('/')[0] ?? '';
  const bare = head.match(SITE);
  if (bare) return bare[1].replace(/\s+/g, ' ').trim();

  return null;
}

export function pickCustomField(fields: RedmineCustomField[], name: string): string {
  const found = (fields ?? []).find((f) => f?.name === name);
  return found?.value == null ? '' : String(found.value);
}

/**
 * 이슈 하나를 조회한다.
 *
 * 실패하면 예외 대신 null 이다. PMS 는 선택적 의존이고, 여기서 던지면
 * 이관 스크립트와 업로드가 통째로 멈춘다.
 */
export async function fetchIssue(
  id: number,
  deps: { fetch?: typeof fetch } = {}
): Promise<PmsIssue | null> {
  const doFetch = deps.fetch ?? fetch;
  const base = process.env.PMS_BASE_URL || 'https://pms.parksystems.com';
  const key = process.env.PMS_API_KEY;

  try {
    const res = await doFetch(`${base}/issues/${id}.json`, {
      headers: key ? { 'X-Redmine-API-Key': key } : {},
    });

    if (!res.ok) return null;

    const body = (await res.json()) as { issue?: Record<string, any> };
    const issue = body?.issue;
    if (!issue) return null;

    const fields = (issue.custom_fields ?? []) as RedmineCustomField[];

    return {
      issueId: Number(issue.id),
      subject: String(issue.subject ?? ''),
      status: String(issue.status?.name ?? ''),
      isClosed: Boolean(issue.status?.is_closed),
      tracker: String(issue.tracker?.name ?? ''),
      priority: String(issue.priority?.name ?? ''),
      author: String(issue.author?.name ?? ''),
      assignee: String(issue.assigned_to?.name ?? ''),
      swVersion: pickCustomField(fields, 'Software Version'),
      xesVersion: pickCustomField(fields, 'XEService Version'),
      originSite: parseOriginSite(String(issue.subject ?? '')),
      createdOn: issue.created_on ?? null,
      updatedOn: issue.updated_on ?? null,
      closedOn: issue.closed_on ?? null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- lib/pms/redmine.test.ts`
Expected: PASS — 8 tests

- [ ] **Step 5: 전체 테스트 확인 후 커밋**

```bash
npm test
git add lib/pms/redmine.ts lib/pms/redmine.test.ts
git commit -m "feat: add Redmine issue client with origin-site extraction"
```

---

# Phase B — 스키마와 이관

---

### Task 7: 새 스키마

**Files:**
- Create: `supabase/schema-v2.sql`

**Interfaces:**
- Consumes: 없음
- Produces: 테이블 `deployments`, `deployment_items`, `deployment_pms_refs`, `deployment_alarms`, `pms_issues`

**이 태스크는 구 테이블을 건드리지 않는다.** 새 테이블만 만든다.

- [ ] **Step 1: 스키마 SQL 작성**

Create `supabase/schema-v2.sql`:

```sql
-- ============================================================
-- SW 버전 이력 조회 도구 — 스키마 v2
-- 구 테이블(notes 등)은 건드리지 않는다. 이관 검증 후 별도로 정리한다.
-- Supabase SQL Editor 에 전체 복사 후 실행
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. deployments : 배포 이벤트 1건 = 문서 1장
CREATE TABLE IF NOT EXISTS deployments (
  id              UUID        NOT NULL DEFAULT gen_random_uuid(),
  site            TEXT        NOT NULL,
  equipment       TEXT        NOT NULL DEFAULT 'EQ01',
  model           TEXT        NOT NULL DEFAULT '',
  deployed_on     DATE,

  xea_from_raw    TEXT        NOT NULL DEFAULT '',
  xea_from_build  INTEGER,
  xea_to_raw      TEXT        NOT NULL DEFAULT '',
  xea_to_build    INTEGER,
  xes_from_raw    TEXT        NOT NULL DEFAULT '',
  xes_from_build  INTEGER,
  xes_to_raw      TEXT        NOT NULL DEFAULT '',
  xes_to_build    INTEGER,
  cim_ver         TEXT        NOT NULL DEFAULT '',

  author          TEXT        NOT NULL DEFAULT '',
  source_kind     TEXT        NOT NULL DEFAULT 'html_upload',
  source_file     TEXT        NOT NULL DEFAULT '',
  raw_html        TEXT,
  body_text       TEXT        NOT NULL DEFAULT '',
  edited_at       TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT deployments_pkey PRIMARY KEY (id),
  CONSTRAINT deployments_source_kind_check
    CHECK (source_kind IN ('html_upload', 'legacy_json'))
);

-- 같은 설비에 같은 버전 조합이 두 번 들어가지 않게 한다.
-- 이관 스크립트를 여러 번 돌려도 결과가 같아야 하므로 날짜까지 포함한다.
--
-- NULLS NOT DISTINCT (PG15+) 가 필요하다. 버전을 못 읽은 행은 build 가 NULL 인데,
-- 기본 동작에서는 NULL 끼리 서로 다르다고 보아 중복이 그대로 쌓인다.
-- 표현식(COALESCE) 대신 순수 컬럼으로 둔다 — 그래야 나중에 필요하면
-- PostgREST 의 on_conflict 로도 지정할 수 있다.
CREATE UNIQUE INDEX IF NOT EXISTS deployments_identity_key
  ON deployments (site, equipment, deployed_on, xea_to_build, xes_to_build)
  NULLS NOT DISTINCT;

CREATE INDEX IF NOT EXISTS idx_deployments_site_eq_date
  ON deployments (site, equipment, deployed_on DESC);

-- 2. deployment_items : 문서 안의 개별 개선 항목
CREATE TABLE IF NOT EXISTS deployment_items (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  deployment_id  UUID        NOT NULL,
  pms_no         INTEGER,
  anchor_id      TEXT        NOT NULL DEFAULT '',
  section        TEXT        NOT NULL DEFAULT '',
  section_no     INTEGER     NOT NULL DEFAULT 0,
  title          TEXT        NOT NULL DEFAULT '',
  phenomenon     TEXT        NOT NULL DEFAULT '',
  improvements   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  flags          TEXT[]      NOT NULL DEFAULT '{}',
  body_text      TEXT        NOT NULL DEFAULT '',
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT deployment_items_pkey PRIMARY KEY (id),
  CONSTRAINT deployment_items_dep_fk FOREIGN KEY (deployment_id)
    REFERENCES deployments (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_deployment
  ON deployment_items (deployment_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_items_pms_no
  ON deployment_items (pms_no) WHERE pms_no IS NOT NULL;

-- 3. deployment_pms_refs : 배포 <-> PMS 링크. 레거시 배포도 여기로 역조회에 참여한다.
CREATE TABLE IF NOT EXISTS deployment_pms_refs (
  deployment_id  UUID        NOT NULL,
  pms_no         INTEGER     NOT NULL,
  source         TEXT        NOT NULL DEFAULT 'item',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT deployment_pms_refs_pkey PRIMARY KEY (deployment_id, pms_no),
  CONSTRAINT deployment_pms_refs_dep_fk FOREIGN KEY (deployment_id)
    REFERENCES deployments (id) ON DELETE CASCADE,
  CONSTRAINT deployment_pms_refs_source_check
    CHECK (source IN ('item', 'legacy_text', 'alarm'))
);

CREATE INDEX IF NOT EXISTS idx_pms_refs_pms_no
  ON deployment_pms_refs (pms_no);

-- 4. deployment_alarms : '신규 Alarm' 표
CREATE TABLE IF NOT EXISTS deployment_alarms (
  id             UUID        NOT NULL DEFAULT gen_random_uuid(),
  deployment_id  UUID        NOT NULL,
  alarm_id       TEXT        NOT NULL DEFAULT '',
  text           TEXT        NOT NULL DEFAULT '',
  pms_no         INTEGER,

  CONSTRAINT deployment_alarms_pkey PRIMARY KEY (id),
  CONSTRAINT deployment_alarms_dep_fk FOREIGN KEY (deployment_id)
    REFERENCES deployments (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alarms_deployment
  ON deployment_alarms (deployment_id);

-- 5. pms_issues : Redmine 캐시. 없어도 도구는 동작한다.
CREATE TABLE IF NOT EXISTS pms_issues (
  issue_id     INTEGER     NOT NULL,
  subject      TEXT        NOT NULL DEFAULT '',
  status       TEXT        NOT NULL DEFAULT '',
  is_closed    BOOLEAN     NOT NULL DEFAULT false,
  tracker      TEXT        NOT NULL DEFAULT '',
  priority     TEXT        NOT NULL DEFAULT '',
  author       TEXT        NOT NULL DEFAULT '',
  assignee     TEXT        NOT NULL DEFAULT '',
  sw_version   TEXT        NOT NULL DEFAULT '',
  xes_version  TEXT        NOT NULL DEFAULT '',
  origin_site  TEXT,
  created_on   TIMESTAMPTZ,
  updated_on   TIMESTAMPTZ,
  closed_on    TIMESTAMPTZ,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pms_issues_pkey PRIMARY KEY (issue_id)
);

-- updated_at 트리거 (set_updated_at 함수는 기존 schema.sql 에서 이미 만들어져 있다)
CREATE OR REPLACE TRIGGER trg_deployments_updated_at
  BEFORE UPDATE ON deployments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS — Phase 1: 비활성 (기존 정책과 동일)
ALTER TABLE deployments         DISABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_items    DISABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_pms_refs DISABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_alarms   DISABLE ROW LEVEL SECURITY;
ALTER TABLE pms_issues          DISABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Supabase SQL Editor 에서 실행**

Supabase 대시보드 → SQL Editor → 위 파일 전체 붙여넣기 → Run.
Expected: `Success. No rows returned`

- [ ] **Step 3: 테이블 생성 확인**

SQL Editor에서:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('deployments','deployment_items','deployment_pms_refs','deployment_alarms','pms_issues')
ORDER BY table_name;
```

Expected: 5행

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema-v2.sql
git commit -m "feat: add deployment history schema"
```

---

### Task 8: 쿼리 레이어

**Files:**
- Create: `lib/queries/types.ts`
- Create: `lib/queries/deployments.ts`

**Interfaces:**
- Consumes: `createServerClient` (`lib/supabase.ts`)
- Produces:
  - `listEquipment(): Promise<EquipmentSummary[]>`
  - `getTimeline(site: string, equipment: string): Promise<DeploymentWithItems[]>`
  - `getDeployment(id: string): Promise<DeploymentWithItems | null>`
  - `searchItems(query: string): Promise<SearchHit[]>`
  - `insertDeployment(draft: DeploymentDraft): Promise<string>`
  - 타입 `DeploymentRow`, `DeploymentItemRow`, `DeploymentWithItems`, `EquipmentSummary`, `SearchHit`, `DeploymentDraft`

- [ ] **Step 1: 타입 정의**

Create `lib/queries/types.ts`:

```ts
import type { ParsedImprovement } from '@/lib/parsers/types';

export type DeploymentRow = {
  id: string;
  site: string;
  equipment: string;
  model: string;
  deployed_on: string | null;
  xea_from_raw: string;
  xea_from_build: number | null;
  xea_to_raw: string;
  xea_to_build: number | null;
  xes_from_raw: string;
  xes_from_build: number | null;
  xes_to_raw: string;
  xes_to_build: number | null;
  cim_ver: string;
  author: string;
  source_kind: 'html_upload' | 'legacy_json';
  source_file: string;
  body_text: string;
  edited_at: string | null;
  updated_at: string;
};

export type DeploymentItemRow = {
  id: string;
  deployment_id: string;
  pms_no: number | null;
  anchor_id: string;
  section: string;
  section_no: number;
  title: string;
  phenomenon: string;
  improvements: ParsedImprovement[];
  flags: string[];
  body_text: string;
  sort_order: number;
};

export type DeploymentWithItems = DeploymentRow & {
  items: DeploymentItemRow[];
  raw_html?: string | null;
};

export type EquipmentSummary = {
  site: string;
  equipment: string;
  model: string;
  latestDeployedOn: string | null;
  xeaToRaw: string;
  xesToRaw: string;
  deploymentCount: number;
  notAppliedCount: number;
};

export type SearchHit = {
  itemId: string | null;
  deploymentId: string;
  site: string;
  equipment: string;
  deployedOn: string | null;
  xeaToRaw: string;
  xesToRaw: string;
  sourceKind: 'html_upload' | 'legacy_json';
  pmsNo: number | null;
  section: string;
  title: string;
  snippet: string;
  notApplied: boolean;
};

export type DeploymentDraft = {
  site: string;
  equipment: string;
  model: string;
  deployedOn: string | null;
  xeaFromRaw: string; xeaFromBuild: number | null;
  xeaToRaw: string;   xeaToBuild: number | null;
  xesFromRaw: string; xesFromBuild: number | null;
  xesToRaw: string;   xesToBuild: number | null;
  cimVer: string;
  author: string;
  sourceKind: 'html_upload' | 'legacy_json';
  sourceFile: string;
  rawHtml: string | null;
  edited: boolean;
  /**
   * 전문 검색용 본문. 비워 두면 items 에서 만든다.
   * 레거시는 items 가 없으므로 요약을 여기에 직접 넣는다.
   */
  bodyText?: string;
  items: Array<{
    pmsNo: number | null;
    pmsExtra: number[];
    anchorId: string;
    section: string;
    sectionNo: number;
    title: string;
    phenomenon: string;
    improvements: ParsedImprovement[];
    flags: string[];
    sortOrder: number;
  }>;
  alarms: Array<{ alarmId: string; text: string; pmsNo: number | null }>;
  /** 레거시 전용. 요약 텍스트에서 뽑은 PMS 번호 */
  legacyPmsRefs?: number[];
};
```

- [ ] **Step 2: 쿼리 구현**

Create `lib/queries/deployments.ts`:

```ts
import { createServerClient } from '@/lib/supabase';
import type {
  DeploymentRow,
  DeploymentItemRow,
  DeploymentWithItems,
  DeploymentDraft,
  EquipmentSummary,
  SearchHit,
} from '@/lib/queries/types';

const DEPLOYMENT_COLUMNS =
  'id, site, equipment, model, deployed_on, ' +
  'xea_from_raw, xea_from_build, xea_to_raw, xea_to_build, ' +
  'xes_from_raw, xes_from_build, xes_to_raw, xes_to_build, ' +
  'cim_ver, author, source_kind, source_file, body_text, edited_at, updated_at';

export async function listEquipment(): Promise<EquipmentSummary[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('deployments')
    .select(`${DEPLOYMENT_COLUMNS}, deployment_items(flags)`)
    .order('deployed_on', { ascending: false });

  if (error) throw new Error(error.message);

  const byKey = new Map<string, EquipmentSummary>();

  for (const row of (data ?? []) as any[]) {
    const key = `${row.site}::${row.equipment}`;
    const notApplied = (row.deployment_items ?? []).filter((i: any) =>
      (i.flags ?? []).includes('not_applied')
    ).length;

    const existing = byKey.get(key);
    if (!existing) {
      // 정렬이 최신순이므로 처음 만나는 행이 최신 배포다.
      byKey.set(key, {
        site: row.site,
        equipment: row.equipment,
        model: row.model,
        latestDeployedOn: row.deployed_on,
        xeaToRaw: row.xea_to_raw,
        xesToRaw: row.xes_to_raw,
        deploymentCount: 1,
        notAppliedCount: notApplied,
      });
    } else {
      existing.deploymentCount += 1;
      existing.notAppliedCount += notApplied;
    }
  }

  return [...byKey.values()].sort((a, b) => a.site.localeCompare(b.site));
}

export async function getTimeline(
  site: string,
  equipment: string
): Promise<DeploymentWithItems[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('deployments')
    .select(`${DEPLOYMENT_COLUMNS}, deployment_items(*)`)
    .eq('site', site)
    .eq('equipment', equipment)
    .order('deployed_on', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => ({
    ...(row as DeploymentRow),
    items: ((row.deployment_items ?? []) as DeploymentItemRow[]).sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));
}

export async function getDeployment(id: string): Promise<DeploymentWithItems | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('deployments')
    .select(`${DEPLOYMENT_COLUMNS}, raw_html, deployment_items(*)`)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as any;
  return {
    ...(row as DeploymentRow),
    raw_html: row.raw_html ?? null,
    items: ((row.deployment_items ?? []) as DeploymentItemRow[]).sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  };
}

/**
 * PMS 번호 또는 키워드로 항목을 찾는다.
 *
 * ILIKE 로 간다. 배포 100건 규모에서 tsvector 는 한국어 토크나이저가 약해
 * 이득이 없다. 느려지면 그때 pg_trgm 을 단다.
 */
export async function searchItems(query: string): Promise<SearchHit[]> {
  const supabase = createServerClient();
  const term = String(query ?? '').trim();
  if (!term) return [];

  const asNumber = /^\d{3,5}$/.test(term) ? Number(term) : null;
  const hits: SearchHit[] = [];

  // 1) 항목 단위 (html_upload 출처)
  let itemQuery = supabase
    .from('deployment_items')
    .select(`*, deployments!inner(${DEPLOYMENT_COLUMNS})`)
    .limit(200);

  itemQuery = asNumber
    ? itemQuery.eq('pms_no', asNumber)
    : itemQuery.or(
        `title.ilike.%${term}%,phenomenon.ilike.%${term}%,body_text.ilike.%${term}%`
      );

  const { data: itemRows, error: itemError } = await itemQuery;
  if (itemError) throw new Error(itemError.message);

  for (const row of (itemRows ?? []) as any[]) {
    const dep = row.deployments;
    hits.push({
      itemId: row.id,
      deploymentId: dep.id,
      site: dep.site,
      equipment: dep.equipment,
      deployedOn: dep.deployed_on,
      xeaToRaw: dep.xea_to_raw,
      xesToRaw: dep.xes_to_raw,
      sourceKind: dep.source_kind,
      pmsNo: row.pms_no,
      section: row.section,
      title: row.title,
      snippet: String(row.phenomenon || row.body_text || '').slice(0, 200),
      notApplied: (row.flags ?? []).includes('not_applied'),
    });
  }

  // 2) 레거시 배포 — 항목이 없으므로 배포 단위로 잡는다
  let depQuery = supabase.from('deployments').select(DEPLOYMENT_COLUMNS).limit(200);

  if (asNumber) {
    const { data: refs } = await supabase
      .from('deployment_pms_refs')
      .select('deployment_id')
      .eq('pms_no', asNumber);
    const ids = (refs ?? []).map((r: any) => r.deployment_id);
    if (!ids.length) return hits;
    depQuery = depQuery.in('id', ids);
  } else {
    depQuery = depQuery.ilike('body_text', `%${term}%`);
  }

  const { data: depRows, error: depError } = await depQuery;
  if (depError) throw new Error(depError.message);

  const seen = new Set(hits.map((h) => h.deploymentId));

  for (const dep of (depRows ?? []) as any[]) {
    if (seen.has(dep.id)) continue;
    hits.push({
      itemId: null,
      deploymentId: dep.id,
      site: dep.site,
      equipment: dep.equipment,
      deployedOn: dep.deployed_on,
      xeaToRaw: dep.xea_to_raw,
      xesToRaw: dep.xes_to_raw,
      sourceKind: dep.source_kind,
      pmsNo: asNumber,
      section: '',
      title: '(항목 미분해 — 배포 요약에서 발견)',
      snippet: String(dep.body_text ?? '').slice(0, 200),
      notApplied: false,
    });
  }

  return hits.sort((a, b) => String(b.deployedOn).localeCompare(String(a.deployedOn)));
}

/**
 * 배포 1건과 딸린 행들을 저장하고 id 를 돌려준다.
 *
 * 같은 배포가 이미 있으면 그 id 를 재사용하고 자식 행을 갈아끼운다.
 * 이관 스크립트를 여러 번 돌려도 결과가 같아야 한다.
 *
 * upsert 의 on_conflict 를 쓰지 않고 직접 찾아서 갱신한다. PostgREST 의
 * on_conflict 는 컬럼 목록만 받아 인덱스 이름을 지정할 수 없고, NULL 이 섞인
 * 식별자에서 동작이 미묘하다. 90건 규모라 조회 한 번이 비싸지 않다.
 */
export async function insertDeployment(draft: DeploymentDraft): Promise<string> {
  const supabase = createServerClient();

  const bodyText =
    draft.bodyText ??
    draft.items
      .map((i) => [i.title, i.phenomenon, ...i.improvements.flatMap((g) => g.lines)].join('\n'))
      .join('\n');

  const payload = {
    site: draft.site,
    equipment: draft.equipment,
    model: draft.model,
    deployed_on: draft.deployedOn,
    xea_from_raw: draft.xeaFromRaw, xea_from_build: draft.xeaFromBuild,
    xea_to_raw: draft.xeaToRaw,     xea_to_build: draft.xeaToBuild,
    xes_from_raw: draft.xesFromRaw, xes_from_build: draft.xesFromBuild,
    xes_to_raw: draft.xesToRaw,     xes_to_build: draft.xesToBuild,
    cim_ver: draft.cimVer,
    author: draft.author,
    source_kind: draft.sourceKind,
    source_file: draft.sourceFile,
    raw_html: draft.rawHtml,
    body_text: bodyText,
    edited_at: draft.edited ? new Date().toISOString() : null,
  };

  // 식별자로 기존 배포를 찾는다. NULL 은 .is() 로 비교해야 한다 — .eq(null) 은 안 맞는다.
  let finder = supabase
    .from('deployments')
    .select('id')
    .eq('site', draft.site)
    .eq('equipment', draft.equipment);

  finder = draft.deployedOn
    ? finder.eq('deployed_on', draft.deployedOn)
    : finder.is('deployed_on', null);
  finder = draft.xeaToBuild != null
    ? finder.eq('xea_to_build', draft.xeaToBuild)
    : finder.is('xea_to_build', null);
  finder = draft.xesToBuild != null
    ? finder.eq('xes_to_build', draft.xesToBuild)
    : finder.is('xes_to_build', null);

  const { data: existing, error: findError } = await finder.limit(1).maybeSingle();
  if (findError) throw new Error(findError.message);

  let deploymentId: string;

  if (existing) {
    deploymentId = (existing as any).id as string;
    const { error } = await supabase.from('deployments').update(payload).eq('id', deploymentId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('deployments')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    deploymentId = (data as any).id as string;
  }

  // 자식 행은 통째로 갈아끼운다.
  await supabase.from('deployment_items').delete().eq('deployment_id', deploymentId);
  await supabase.from('deployment_alarms').delete().eq('deployment_id', deploymentId);
  await supabase.from('deployment_pms_refs').delete().eq('deployment_id', deploymentId);

  if (draft.items.length) {
    const { error: itemError } = await supabase.from('deployment_items').insert(
      draft.items.map((i) => ({
        deployment_id: deploymentId,
        pms_no: i.pmsNo,
        anchor_id: i.anchorId,
        section: i.section,
        section_no: i.sectionNo,
        title: i.title,
        phenomenon: i.phenomenon,
        improvements: i.improvements,
        flags: i.flags,
        body_text: [i.title, i.phenomenon, ...i.improvements.flatMap((g) => g.lines)].join('\n'),
        sort_order: i.sortOrder,
      }))
    );
    if (itemError) throw new Error(itemError.message);
  }

  if (draft.alarms.length) {
    await supabase.from('deployment_alarms').insert(
      draft.alarms.map((a) => ({
        deployment_id: deploymentId,
        alarm_id: a.alarmId,
        text: a.text,
        pms_no: a.pmsNo,
      }))
    );
  }

  // PMS 링크 — 항목/알람/레거시 텍스트를 한데 모아 중복 제거
  const refs = new Map<number, string>();
  for (const i of draft.items) {
    if (i.pmsNo != null) refs.set(i.pmsNo, 'item');
    for (const extra of i.pmsExtra) refs.set(extra, 'item');
  }
  for (const a of draft.alarms) {
    if (a.pmsNo != null && !refs.has(a.pmsNo)) refs.set(a.pmsNo, 'alarm');
  }
  for (const n of draft.legacyPmsRefs ?? []) {
    if (!refs.has(n)) refs.set(n, 'legacy_text');
  }

  if (refs.size) {
    await supabase.from('deployment_pms_refs').insert(
      [...refs.entries()].map(([pms_no, source]) => ({
        deployment_id: deploymentId,
        pms_no,
        source,
      }))
    );
  }

  return deploymentId;
}
```

- [ ] **Step 3: 타입 검사 통과 확인**

Run: `npx tsc --noEmit`
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add lib/queries
git commit -m "feat: add deployment query layer"
```

---

### Task 9: 레거시 이관 스크립트

**Files:**
- Create: `scripts/migrate-legacy.ts`
- Test: `scripts/migrate-legacy.test.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `parseVersionRange` (Task 1), `extractPmsNumbers` (Task 5), `fetchIssue` (Task 6), `insertDeployment` (Task 8)
- Produces:
  - `loadLegacyFiles(dir: string): LegacyFile[]`
  - `toDrafts(file: LegacyFile): DeploymentDraft[]`
  - `buildReport(drafts: DeploymentDraft[]): MigrationReport`

순수 변환 부분과 DB 쓰기를 분리한다. 그래야 변환을 테스트할 수 있다.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `scripts/migrate-legacy.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { loadLegacyFiles, toDrafts, buildReport } from '@/scripts/migrate-legacy';

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
```

- [ ] **Step 2: vitest include 에 scripts 가 있는지 확인**

Task 1의 `vitest.config.ts`에 이미 `'scripts/**/*.test.ts'`가 있다. 없으면 추가한다.

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm test -- scripts/migrate-legacy.test.ts`
Expected: FAIL — `Failed to resolve import "@/scripts/migrate-legacy"`

- [ ] **Step 4: 구현**

Create `scripts/migrate-legacy.ts`:

```ts
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
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- scripts/migrate-legacy.test.ts`
Expected: PASS — 10 tests

- [ ] **Step 6: 실행 진입점 추가**

`scripts/migrate-legacy.ts` 끝에 추가:

```ts
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
  console.log(`[migrate] 유효 ${valid.size}개 / 버림 ${candidates.size - valid.size}개`);

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
}

if (process.argv[1] && process.argv[1].includes('migrate-legacy')) {
  runMigration().catch((err) => {
    console.error('[migrate] 실패:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 7: `package.json` 스크립트 추가**

```json
"migrate-legacy": "tsx scripts/migrate-legacy.ts"
```

- [ ] **Step 8: 실제 이관 실행**

```bash
npm run migrate-legacy
```

Expected: 리포트 출력. `총 배포 : 90`, `설비별 : { 'SDC A6': 58, 'LGD AP3': 23, 'SDC A5': 5, 'LGD AP4': 3, 'LGD AP5': 1 }`

- [ ] **Step 9: 멱등성 확인 — 한 번 더 돌린다**

```bash
npm run migrate-legacy
```

Supabase SQL Editor에서:

```sql
SELECT count(*) FROM deployments;
```

Expected: `90` (두 번 돌려도 그대로)

- [ ] **Step 10: 커밋**

```bash
git add scripts/migrate-legacy.ts scripts/migrate-legacy.test.ts lib/queries/deployments.ts package.json
git commit -m "feat: migrate legacy release notes into deployment history"
```

---

# Phase C — 조회 화면

---

### Task 10: 타임라인 끊김 계산

**Files:**
- Create: `lib/timeline.ts`
- Test: `lib/timeline.test.ts`

**Interfaces:**
- Consumes: `DeploymentRow` (Task 8)
- Produces: `findGaps(deployments: Pick<DeploymentRow, ...>[]): TimelineGap[]`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `lib/timeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findGaps } from '@/lib/timeline';

const dep = (id: string, xeaFrom: number | null, xeaTo: number | null) => ({
  id,
  xea_from_build: xeaFrom,
  xea_to_build: xeaTo,
  xes_from_build: null,
  xes_to_build: null,
});

describe('findGaps', () => {
  it('이어지는 배포에는 끊김이 없다', () => {
    // 최신순 입력: 3600에서 3700, 그 전이 3500에서 3600
    const gaps = findGaps([dep('b', 3600, 3700), dep('a', 3500, 3600)]);
    expect(gaps).toHaveLength(0);
  });

  it('앞 배포의 to 와 뒤 배포의 from 이 다르면 끊김', () => {
    const gaps = findGaps([dep('b', 3650, 3700), dep('a', 3500, 3600)]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      component: 'xea',
      fromBuild: 3600,
      toBuild: 3650,
      newerId: 'b',
      olderId: 'a',
    });
  });

  it('빌드 번호를 못 읽은 배포는 판단하지 않는다', () => {
    expect(findGaps([dep('b', null, 3700), dep('a', 3500, null)])).toHaveLength(0);
  });

  it('from 이 없는 단일 값 배포(레거시)는 판단하지 않는다', () => {
    expect(findGaps([dep('b', null, 3700), dep('a', null, 3600)])).toHaveLength(0);
  });

  it('배포가 1건이면 끊김이 없다', () => {
    expect(findGaps([dep('a', 3500, 3600)])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm test -- lib/timeline.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/timeline"`

- [ ] **Step 3: 구현**

Create `lib/timeline.ts`:

```ts
export type TimelineGap = {
  component: 'xea' | 'xes';
  newerId: string;
  olderId: string;
  fromBuild: number;
  toBuild: number;
};

type GapInput = {
  id: string;
  xea_from_build: number | null;
  xea_to_build: number | null;
  xes_from_build: number | null;
  xes_to_build: number | null;
};

/**
 * 배포 사이에 기록되지 않은 구간이 있는지 찾는다.
 *
 * 앞선 배포가 Dev3600 에서 끝났는데 다음 배포가 Dev3650 에서 시작하면,
 * 3600~3650 사이의 배포가 기록되지 않았다는 뜻이다.
 *
 * 숨기지 않는다. '여기 기록이 비었다'는 이 도구가 알려줘야 할 정보다.
 * 단, 빌드 번호를 못 읽은 배포는 판단 근거가 없으므로 조용히 건너뛴다 —
 * 모르는 것을 끊김으로 단정하면 거짓 경고가 된다.
 *
 * 입력은 최신순(deployed_on DESC)을 가정한다.
 */
export function findGaps(deployments: GapInput[]): TimelineGap[] {
  const gaps: TimelineGap[] = [];
  const components: Array<'xea' | 'xes'> = ['xea', 'xes'];

  for (let i = 0; i < deployments.length - 1; i += 1) {
    const newer = deployments[i];
    const older = deployments[i + 1];

    for (const component of components) {
      const newerFrom = newer[`${component}_from_build`];
      const olderTo = older[`${component}_to_build`];

      if (newerFrom == null || olderTo == null) continue;
      if (newerFrom === olderTo) continue;

      gaps.push({
        component,
        newerId: newer.id,
        olderId: older.id,
        fromBuild: olderTo,
        toBuild: newerFrom,
      });
    }
  }

  return gaps;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- lib/timeline.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: 커밋**

```bash
git add lib/timeline.ts lib/timeline.test.ts
git commit -m "feat: detect missing build ranges between deployments"
```

---

### Task 11: 설비 목록 화면

**Files:**
- Modify: `app/page.tsx`
- Create: `components/history/equipment-summary-card.tsx`
- Modify: `app/layout.tsx:14-17` (metadata)

**Interfaces:**
- Consumes: `listEquipment` (Task 8), `EquipmentSummary` (Task 8)
- Produces: 없음 (화면)

- [ ] **Step 1: 카드 컴포넌트 작성**

Create `components/history/equipment-summary-card.tsx`:

```tsx
import Link from 'next/link';
import type { EquipmentSummary } from '@/lib/queries/types';

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}

export function EquipmentSummaryCard({ item }: { item: EquipmentSummary }) {
  const href = `/site/${encodeURIComponent(item.site)}/${encodeURIComponent(item.equipment)}`;

  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-2xl border border-park-border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-extrabold text-park-navy">
            {item.site} / {item.equipment}
          </h2>
          <p className="mt-1 truncate text-sm text-slate-500">{item.model || '모델 미상'}</p>
        </div>
        {item.notAppliedCount > 0 ? (
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            미적용 {item.notAppliedCount}
          </span>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-park-border pt-4">
        <MetaRow label="최근 배포" value={item.latestDeployedOn ?? '-'} />
        <MetaRow label="XEA" value={item.xeaToRaw || '-'} />
        <MetaRow label="XES" value={item.xesToRaw || '-'} />
        <MetaRow label="배포 이력" value={`${item.deploymentCount}건`} />
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: 홈 화면 교체**

`app/page.tsx` 전체를 다음으로 바꾼다 (기존 `redirect('/dashboard')` 제거):

```tsx
import Link from 'next/link';
import { listEquipment } from '@/lib/queries/deployments';
import { EquipmentSummaryCard } from '@/components/history/equipment-summary-card';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const equipment = await listEquipment();

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-park-navy">SW 버전 이력</h1>
          <p className="mt-1 text-sm text-slate-500">
            사이트별 SW 버전과 각 버전에 적용된 개선 내역
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/search"
            className="rounded-lg border border-park-border px-4 py-2 text-sm font-semibold text-park-navy hover:bg-slate-50"
          >
            PMS · 키워드 검색
          </Link>
          <Link
            href="/upload"
            className="rounded-lg bg-park-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            문서 업로드
          </Link>
        </div>
      </header>

      {equipment.length === 0 ? (
        <p className="rounded-2xl border border-park-border bg-white p-10 text-center text-slate-500">
          등록된 배포 이력이 없습니다.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((item) => (
            <EquipmentSummaryCard key={`${item.site}-${item.equipment}`} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: metadata 수정**

`app/layout.tsx`의 `metadata`를 바꾼다:

```ts
export const metadata: Metadata = {
  title: "SW 버전 이력",
  description: "사이트별 SW 버전 및 버전별 적용 내역 조회",
};
```

같은 파일의 `<html lang="en"` 을 `<html lang="ko"` 로 바꾼다.

- [ ] **Step 4: 화면 확인**

```bash
npm run dev
```

`http://localhost:3000` 에서 설비 카드 5개(SDC A5·A6, LGD AP3·AP4·AP5)가 보이는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add app/page.tsx app/layout.tsx components/history
git commit -m "feat: replace home with equipment version summary"
```

---

### Task 12: 사이트 타임라인 화면

**Files:**
- Create: `app/site/[site]/[equipment]/page.tsx`
- Create: `components/history/deployment-timeline.tsx`
- Create: `components/history/item-detail.tsx`

**Interfaces:**
- Consumes: `getTimeline` (Task 8), `findGaps` (Task 10), `DeploymentWithItems` (Task 8)
- Produces: 없음 (화면)

- [ ] **Step 1: 항목 상세 컴포넌트**

Create `components/history/item-detail.tsx`:

```tsx
import type { DeploymentItemRow } from '@/lib/queries/types';

const PMS_BASE = 'https://pms.parksystems.com';

export function ItemDetail({ item }: { item: DeploymentItemRow }) {
  return (
    <div className="border-t border-park-border py-4">
      <div className="flex flex-wrap items-center gap-2">
        {item.pms_no ? (
          <a
            href={`${PMS_BASE}/issues/${item.pms_no}`}
            target="_blank"
            rel="noreferrer"
            className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-park-navy hover:bg-slate-200"
          >
            PMS #{item.pms_no}
          </a>
        ) : null}
        {item.flags.includes('not_applied') ? (
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            미적용
          </span>
        ) : null}
        <span className="text-xs text-slate-400">{item.section}</span>
      </div>

      <h4 className="mt-2 font-semibold text-slate-800">{item.title}</h4>

      {item.phenomenon ? (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
          <span className="font-semibold text-slate-500">현상 </span>
          {item.phenomenon}
        </p>
      ) : null}

      {item.improvements.map((group) => (
        <div key={group.component} className="mt-3">
          <span className="rounded bg-park-navy px-2 py-0.5 text-xs font-bold uppercase text-white">
            {group.component}
          </span>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {group.lines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 타임라인 컴포넌트**

Create `components/history/deployment-timeline.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DeploymentWithItems } from '@/lib/queries/types';
import type { TimelineGap } from '@/lib/timeline';
import { ItemDetail } from './item-detail';

function VersionArrow({ from, to }: { from: string; to: string }) {
  if (!from && !to) return <span className="text-slate-400">-</span>;
  if (!from) return <span className="font-mono text-sm">{to}</span>;
  return (
    <span className="font-mono text-sm">
      {from} <span className="text-slate-400">→</span> {to}
    </span>
  );
}

function GapNotice({ gap }: { gap: TimelineGap }) {
  return (
    <div className="my-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">
      {gap.component.toUpperCase()} Dev{gap.fromBuild} ~ Dev{gap.toBuild} 구간의 배포 기록이
      없습니다.
    </div>
  );
}

export function DeploymentTimeline({
  deployments,
  gaps,
}: {
  deployments: DeploymentWithItems[];
  gaps: TimelineGap[];
}) {
  const [open, setOpen] = useState<string | null>(deployments[0]?.id ?? null);

  return (
    <ol className="space-y-3">
      {deployments.map((dep, index) => {
        const isOpen = open === dep.id;
        const isLegacy = dep.source_kind === 'legacy_json';
        const gapsAfter = gaps.filter((g) => g.newerId === dep.id);

        return (
          <li key={dep.id}>
            {gapsAfter.map((gap) => (
              <GapNotice key={`${gap.component}-${gap.newerId}`} gap={gap} />
            ))}

            <article className="rounded-2xl border border-park-border bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : dep.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-park-navy">{dep.deployed_on ?? '날짜 미상'}</span>
                    {isLegacy ? (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        과거 기록
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-0.5 text-slate-600">
                    <div>
                      <span className="mr-2 text-xs text-slate-400">XEA</span>
                      <VersionArrow from={dep.xea_from_raw} to={dep.xea_to_raw} />
                    </div>
                    <div>
                      <span className="mr-2 text-xs text-slate-400">XES</span>
                      <VersionArrow from={dep.xes_from_raw} to={dep.xes_to_raw} />
                    </div>
                  </div>
                </div>
                <span className="text-sm text-slate-500">
                  {isLegacy ? '요약만' : `${dep.items.length}개 항목`}
                </span>
              </button>

              {isOpen ? (
                <div className="px-5 pb-5">
                  {isLegacy ? (
                    <p className="whitespace-pre-line border-t border-park-border pt-4 text-sm text-slate-600">
                      {dep.body_text || '내용 없음'}
                    </p>
                  ) : (
                    <>
                      {dep.items.map((item) => (
                        <ItemDetail key={item.id} item={item} />
                      ))}
                      <Link
                        href={`/deployment/${dep.id}`}
                        className="mt-4 inline-block text-sm font-semibold text-park-navy underline"
                      >
                        원문 문서 보기
                      </Link>
                    </>
                  )}
                </div>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 3: 페이지**

Create `app/site/[site]/[equipment]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTimeline } from '@/lib/queries/deployments';
import { findGaps } from '@/lib/timeline';
import { DeploymentTimeline } from '@/components/history/deployment-timeline';

export const dynamic = 'force-dynamic';

// Next.js 16: params 는 Promise 다.
export default async function SiteTimelinePage({
  params,
}: {
  params: Promise<{ site: string; equipment: string }>;
}) {
  const { site: rawSite, equipment: rawEquipment } = await params;
  const site = decodeURIComponent(rawSite);
  const equipment = decodeURIComponent(rawEquipment);

  const deployments = await getTimeline(site, equipment);
  if (deployments.length === 0) notFound();

  const gaps = findGaps(deployments);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← 설비 목록
      </Link>

      <header className="mb-8 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">
          {site} / {equipment}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          배포 {deployments.length}건
          {gaps.length > 0 ? ` · 기록 누락 구간 ${gaps.length}곳` : ''}
        </p>
      </header>

      <DeploymentTimeline deployments={deployments} gaps={gaps} />
    </main>
  );
}
```

- [ ] **Step 4: 화면 확인**

`npm run dev` → `http://localhost:3000` → SDC A6 카드 클릭.
Expected: 배포 58건이 최신순으로, `과거 기록` 배지가 붙어 보인다. 끊김 구간 표시가 나타난다.

- [ ] **Step 5: 커밋**

```bash
git add app/site components/history
git commit -m "feat: add site deployment timeline with gap detection"
```

---

### Task 13: PMS·키워드 검색

**Files:**
- Create: `app/api/search/route.ts`
- Create: `app/search/page.tsx`
- Create: `components/history/search-panel.tsx`

**Interfaces:**
- Consumes: `searchItems` (Task 8), `SearchHit` (Task 8)
- Produces: `GET /api/search?q=<term>` → `{ ok: true, hits: SearchHit[] }`

- [ ] **Step 1: API 라우트**

Create `app/api/search/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { searchItems } from '@/lib/queries/deployments';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q') ?? '';

  try {
    const hits = await searchItems(q);
    return NextResponse.json({ ok: true, hits });
  } catch (err) {
    console.error('[search]', err);
    return NextResponse.json({ ok: false, hits: [], message: '검색 실패' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 검색 패널**

Create `components/history/search-panel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SearchHit } from '@/lib/queries/types';

export function SearchPanel() {
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!term.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term.trim())}`);
      const body = await res.json();
      setHits(body.hits ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={run} className="flex gap-2">
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="PMS 번호(4952) 또는 키워드(Fatal Following Error)"
          className="flex-1 rounded-lg border border-park-border px-4 py-2.5 text-sm outline-none focus:border-park-navy"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-park-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? '검색 중' : '검색'}
        </button>
      </form>

      {hits === null ? null : hits.length === 0 ? (
        <p className="mt-8 text-center text-slate-500">결과가 없습니다.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {hits.map((hit, idx) => (
            <li
              key={`${hit.deploymentId}-${hit.itemId ?? idx}`}
              className="rounded-2xl border border-park-border bg-white p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Link
                  href={`/site/${encodeURIComponent(hit.site)}/${encodeURIComponent(hit.equipment)}`}
                  className="rounded bg-park-navy px-2 py-0.5 font-bold text-white"
                >
                  {hit.site} / {hit.equipment}
                </Link>
                <span className="text-slate-500">{hit.deployedOn ?? '날짜 미상'}</span>
                <span className="font-mono text-slate-500">
                  XEA {hit.xeaToRaw || '-'} · XES {hit.xesToRaw || '-'}
                </span>
                {hit.notApplied ? (
                  <span className="rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                    미적용
                  </span>
                ) : null}
                {hit.sourceKind === 'legacy_json' ? (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-500">과거 기록</span>
                ) : null}
              </div>

              <h3 className="mt-2 font-semibold text-slate-800">
                {hit.pmsNo ? <span className="mr-2 text-park-navy">#{hit.pmsNo}</span> : null}
                {hit.title}
              </h3>
              <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-slate-600">
                {hit.snippet}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 페이지**

Create `app/search/page.tsx`:

```tsx
import Link from 'next/link';
import { SearchPanel } from '@/components/history/search-panel';

export default function SearchPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← 설비 목록
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">PMS · 키워드 검색</h1>
        <p className="mt-1 text-sm text-slate-500">
          해당 개선이 어느 사이트 · 어느 버전에 들어갔는지 찾습니다.
        </p>
      </header>
      <SearchPanel />
    </main>
  );
}
```

- [ ] **Step 4: 화면 확인**

`http://localhost:3000/search` 에서 `4952` 검색.
Expected: SDC A5 결과. 그다음 한글 키워드로도 결과가 나오는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add app/api/search app/search components/history/search-panel.tsx
git commit -m "feat: add PMS and keyword reverse lookup"
```

---

### Task 14: 원문 문서 보기

**Files:**
- Create: `app/deployment/[id]/page.tsx`

**Interfaces:**
- Consumes: `getDeployment` (Task 8)
- Produces: 없음 (화면)

- [ ] **Step 1: 페이지 작성**

Create `app/deployment/[id]/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDeployment } from '@/lib/queries/deployments';

export const dynamic = 'force-dynamic';

export default async function DeploymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deployment = await getDeployment(id);
  if (!deployment) notFound();

  const back = `/site/${encodeURIComponent(deployment.site)}/${encodeURIComponent(deployment.equipment)}`;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href={back} className="text-sm text-slate-500 hover:underline">
        ← {deployment.site} / {deployment.equipment} 타임라인
      </Link>

      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">
          {deployment.deployed_on ?? '날짜 미상'} 배포 원문
        </h1>
        <p className="mt-1 font-mono text-sm text-slate-500">
          XEA {deployment.xea_to_raw || '-'} · XES {deployment.xes_to_raw || '-'}
        </p>
      </header>

      {deployment.raw_html ? (
        // 사내 유관부서가 만든 문서를 그대로 렌더한다. 외부 입력이 아니다.
        <iframe
          srcDoc={deployment.raw_html}
          title="배포 문서 원문"
          sandbox=""
          className="h-[80vh] w-full rounded-2xl border border-park-border bg-white"
        />
      ) : (
        <div className="rounded-2xl border border-park-border bg-white p-6">
          <p className="mb-3 text-sm text-slate-500">
            원문 문서가 없는 과거 기록입니다. 요약만 남아 있습니다.
          </p>
          <p className="whitespace-pre-line text-sm text-slate-700">
            {deployment.body_text || '내용 없음'}
          </p>
        </div>
      )}
    </main>
  );
}
```

`sandbox=""` 는 iframe 안의 스크립트·폼·팝업을 전부 막는다. 문서는 정적 HTML이므로 표시에 지장이 없다.

- [ ] **Step 2: 화면 확인**

레거시 배포는 요약 텍스트가, 업로드한 문서는 원문이 보여야 한다. 지금은 레거시만 있으므로 요약 표시를 확인한다.

- [ ] **Step 3: 커밋**

```bash
git add app/deployment
git commit -m "feat: render original deployment document"
```

---

# Phase D — 업로드

---

### Task 15: 업로드 API (파싱 · 확정)

**Files:**
- Create: `app/api/upload/parse/route.ts`
- Create: `app/api/upload/commit/route.ts`

**Interfaces:**
- Consumes: `parseUpdateListHtml` (Task 4), `insertDeployment` (Task 8), `verifyDashboardPassword` (`lib/dashboard-password.ts`)
- Produces:
  - `POST /api/upload/parse` body `{ html, fileName }` → `{ ok, document, duplicate }`
  - `POST /api/upload/commit` body `{ password, draft }` → `{ ok, deploymentId }`

- [ ] **Step 1: 파싱 라우트**

Create `app/api/upload/parse/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { parseUpdateListHtml } from '@/lib/parsers/update-list-html';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { html, fileName } = await req.json();
    const document = parseUpdateListHtml(String(html ?? ''));

    // 같은 설비·버전 조합이 이미 있는지 알려준다. 조용히 중복 생성하지 않는다.
    let duplicate: { id: string; deployed_on: string | null } | null = null;
    if (document.header.site && document.header.xeaToBuild != null) {
      const supabase = createServerClient();
      const { data } = await supabase
        .from('deployments')
        .select('id, deployed_on')
        .eq('site', document.header.site)
        .eq('xea_to_build', document.header.xeaToBuild)
        .limit(1);
      duplicate = (data ?? [])[0] ?? null;
    }

    return NextResponse.json({
      ok: true,
      fileName: String(fileName ?? ''),
      document,
      duplicate,
    });
  } catch (err) {
    console.error('[upload/parse]', err);
    return NextResponse.json({ ok: false, message: '파싱 실패' }, { status: 500 });
  }
}
```

- [ ] **Step 2: 확정 저장 라우트**

Create `app/api/upload/commit/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { verifyDashboardPassword } from '@/lib/dashboard-password';
import { insertDeployment } from '@/lib/queries/deployments';
import type { DeploymentDraft } from '@/lib/queries/types';

export async function POST(req: Request) {
  try {
    const { password, draft } = (await req.json()) as {
      password?: string;
      draft?: DeploymentDraft;
    };

    if (!(await verifyDashboardPassword(String(password ?? '')))) {
      return NextResponse.json(
        { ok: false, message: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    if (!draft?.site || !draft?.equipment) {
      return NextResponse.json(
        { ok: false, message: '사이트와 설비를 입력해주세요.' },
        { status: 400 }
      );
    }

    const deploymentId = await insertDeployment({ ...draft, sourceKind: 'html_upload' });
    return NextResponse.json({ ok: true, deploymentId });
  } catch (err) {
    console.error('[upload/commit]', err);
    return NextResponse.json({ ok: false, message: '저장 실패' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 오류 없음

- [ ] **Step 4: 커밋**

```bash
git add app/api/upload
git commit -m "feat: add upload parse and commit endpoints"
```

---

### Task 16: 업로드 화면

**Files:**
- Create: `app/upload/page.tsx`
- Create: `components/upload/upload-wizard.tsx`

**Interfaces:**
- Consumes: `/api/upload/parse`, `/api/upload/commit` (Task 15), `ParsedDocument` (Task 2)
- Produces: 없음 (화면)

미리보기에서 **헤더와 항목 텍스트를 모두 편집**할 수 있어야 한다.

- [ ] **Step 1: 마법사 컴포넌트**

Create `components/upload/upload-wizard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ParsedDocument } from '@/lib/parsers/types';
import type { DeploymentDraft } from '@/lib/queries/types';

type ParseResponse = {
  ok: boolean;
  fileName: string;
  document: ParsedDocument;
  duplicate: { id: string; deployedOn: string | null; message: string } | null;
  message?: string;
};

function toDraft(res: ParseResponse, rawHtml: string): DeploymentDraft {
  const h = res.document.header;
  return {
    site: h.site ?? '',
    equipment: h.equipment ?? 'EQ01',
    model: h.model ?? '',
    deployedOn: null,
    xeaFromRaw: h.xeaFromRaw, xeaFromBuild: h.xeaFromBuild,
    xeaToRaw: h.xeaToRaw,     xeaToBuild: h.xeaToBuild,
    xesFromRaw: h.xesFromRaw, xesFromBuild: h.xesFromBuild,
    xesToRaw: h.xesToRaw,     xesToBuild: h.xesToBuild,
    cimVer: '',
    author: h.author ?? '',
    sourceKind: 'html_upload',
    sourceFile: res.fileName,
    rawHtml,
    edited: false,
    items: res.document.items.map((i) => ({
      pmsNo: i.pmsNo,
      pmsExtra: i.pmsExtra,
      anchorId: i.anchorId,
      section: i.section,
      sectionNo: i.sectionNo,
      title: i.title,
      phenomenon: i.phenomenon,
      improvements: i.improvements,
      flags: i.flags,
      sortOrder: i.sortOrder,
    })),
    alarms: res.document.alarms,
  };
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-park-border px-3 py-2 text-sm outline-none focus:border-park-navy"
      />
    </label>
  );
}

export function UploadWizard() {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [draft, setDraft] = useState<DeploymentDraft | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onFile(file: File) {
    setBusy(true);
    setError('');
    try {
      const html = await file.text();
      const res = await fetch('/api/upload/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, fileName: file.name }),
      });
      const body = (await res.json()) as ParseResponse;
      if (!body.ok) throw new Error(body.message ?? '파싱 실패');
      setParsed(body);
      setDraft(toDraft(body, html));
    } catch (err) {
      setError(err instanceof Error ? err.message : '파싱 실패');
    } finally {
      setBusy(false);
    }
  }

  function patch(next: Partial<DeploymentDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...next, edited: true } : prev));
  }

  function patchItem(index: number, next: Partial<DeploymentDraft['items'][number]>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item, i) => (i === index ? { ...item, ...next } : item));
      return { ...prev, items, edited: true };
    });
  }

  async function commit() {
    if (!draft) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/upload/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, draft }),
      });
      const body = await res.json();
      if (!body.ok) throw new Error(body.message ?? '저장 실패');
      router.push(
        `/site/${encodeURIComponent(draft.site)}/${encodeURIComponent(draft.equipment)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
      setBusy(false);
    }
  }

  if (!parsed || !draft) {
    return (
      <div className="rounded-2xl border border-dashed border-park-border bg-white p-12 text-center">
        <p className="mb-4 text-slate-600">유관부서가 준 SW Update 적용 내역 HTML을 올려주세요.</p>
        <input
          type="file"
          accept=".html,.htm"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
          }}
          className="mx-auto block text-sm"
        />
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {parsed.document.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="mb-2 font-bold text-amber-800">
            확인이 필요한 항목 {parsed.document.warnings.length}건
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {parsed.document.warnings.map((w, idx) => (
              <li key={idx}>
                <span className="font-semibold">{w.field}</span> — {w.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {parsed.duplicate ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-5 text-sm text-red-800">
          같은 사이트·버전의 배포가 이미 등록되어 있습니다
          {parsed.duplicate.deployed_on ? ` (${parsed.duplicate.deployed_on})` : ''}. 저장하면
          덮어씁니다.
        </div>
      ) : null}

      <section className="rounded-2xl border border-park-border bg-white p-6">
        <h3 className="mb-4 font-bold text-park-navy">배포 정보</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="사이트" value={draft.site} onChange={(v) => patch({ site: v })} />
          <Field label="설비" value={draft.equipment} onChange={(v) => patch({ equipment: v })} />
          <Field label="모델" value={draft.model} onChange={(v) => patch({ model: v })} />
          <Field
            label="배포일 (YYYY-MM-DD)"
            value={draft.deployedOn ?? ''}
            onChange={(v) => patch({ deployedOn: v || null })}
          />
          <Field label="XEA 이전" value={draft.xeaFromRaw} onChange={(v) => patch({ xeaFromRaw: v })} />
          <Field label="XEA 이후" value={draft.xeaToRaw} onChange={(v) => patch({ xeaToRaw: v })} />
          <Field label="XES 이전" value={draft.xesFromRaw} onChange={(v) => patch({ xesFromRaw: v })} />
          <Field label="XES 이후" value={draft.xesToRaw} onChange={(v) => patch({ xesToRaw: v })} />
          <Field label="작성자" value={draft.author} onChange={(v) => patch({ author: v })} />
        </div>
      </section>

      <section className="rounded-2xl border border-park-border bg-white p-6">
        <h3 className="mb-4 font-bold text-park-navy">항목 {draft.items.length}건</h3>
        <div className="space-y-4">
          {draft.items.map((item, index) => (
            <div key={item.anchorId} className="rounded-xl border border-park-border p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold">
                  {item.section}
                </span>
                {item.pmsNo ? <span>PMS #{item.pmsNo}</span> : <span className="text-amber-700">PMS 번호 없음</span>}
                {/* 문서가 정의한 범례 문구로 보여준다. 유도 플래그(not_applied)는
                    원시 배지가 이미 같은 뜻을 보여주므로 건너뛴다. */}
                {item.flags
                  .filter((f) => parsed.document.legend[f])
                  .map((f) => (
                    <span key={f} className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">
                      {parsed.document.legend[f]}
                    </span>
                  ))}
              </div>
              <Field label="제목" value={item.title} onChange={(v) => patchItem(index, { title: v })} />
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">현상</span>
                <textarea
                  value={item.phenomenon}
                  onChange={(e) => patchItem(index, { phenomenon: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-park-border px-3 py-2 text-sm outline-none focus:border-park-navy"
                />
              </label>
              {item.improvements.map((group, gi) => (
                <label key={group.component} className="mt-3 block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    개선 · {group.component} (줄바꿈으로 구분)
                  </span>
                  <textarea
                    value={group.lines.join('\n')}
                    onChange={(e) => {
                      const improvements = item.improvements.map((g, i) =>
                        i === gi ? { ...g, lines: e.target.value.split('\n') } : g
                      );
                      patchItem(index, { improvements });
                    }}
                    rows={Math.min(6, group.lines.length + 1)}
                    className="w-full rounded-lg border border-park-border px-3 py-2 text-sm outline-none focus:border-park-navy"
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-park-border bg-white p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-xs font-semibold text-slate-500">업로드 비밀번호</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-park-border px-3 py-2 text-sm outline-none focus:border-park-navy"
            />
          </label>
          <button
            type="button"
            onClick={commit}
            disabled={busy}
            className="rounded-lg bg-park-navy px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? '저장 중' : '확정 저장'}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: 페이지**

Create `app/upload/page.tsx`:

```tsx
import Link from 'next/link';
import { UploadWizard } from '@/components/upload/upload-wizard';

export default function UploadPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← 설비 목록
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-extrabold text-park-navy">배포 문서 업로드</h1>
        <p className="mt-1 text-sm text-slate-500">
          파싱 결과를 확인하고 고친 뒤 저장합니다. 저장 전까지 DB에 쓰지 않습니다.
        </p>
      </header>
      <UploadWizard />
    </main>
  );
}
```

- [ ] **Step 3: 실제 업로드 검증**

`npm run dev` → `http://localhost:3000/upload` → `docs/SDC_A5_Update_List.html` 선택.

Expected:
- 경고 목록에 "설비 번호가 없습니다" 표시
- 사이트 `SDC A5`, 모델 `NX-TSH2225 #1`, XEA `Dev3592` → `Dev4317`
- 항목 34건이 편집 가능한 폼으로 표시
- 배포일을 입력하고 비밀번호를 넣어 저장 → SDC A5 타임라인으로 이동, 새 배포가 최상단에

- [ ] **Step 4: 커밋**

```bash
git add app/upload components/upload
git commit -m "feat: add upload wizard with editable parse preview"
```

---

# Phase E — PMS 보강

---

### Task 17: PMS 캐시 동기화

**Files:**
- Create: `app/api/pms/sync/route.ts`
- Create: `lib/queries/pms.ts`
- Modify: `components/history/item-detail.tsx`
- Modify: `lib/queries/deployments.ts` (getTimeline 에 PMS 캐시 조인)

**Interfaces:**
- Consumes: `fetchIssue` (Task 6), `createServerClient`
- Produces:
  - `syncIssues(ids: number[]): Promise<{ fetched: number; failed: number }>`
  - `getCachedIssues(ids: number[]): Promise<Map<number, PmsIssueRow>>`
  - `POST /api/pms/sync` body `{ password }` → `{ ok, fetched, failed }`

- [ ] **Step 1: 캐시 쿼리**

Create `lib/queries/pms.ts`:

```ts
import { createServerClient } from '@/lib/supabase';
import { fetchIssue } from '@/lib/pms/redmine';

export type PmsIssueRow = {
  issue_id: number;
  subject: string;
  status: string;
  is_closed: boolean;
  assignee: string;
  origin_site: string | null;
  updated_on: string | null;
};

export async function getCachedIssues(ids: number[]): Promise<Map<number, PmsIssueRow>> {
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n)))];
  if (!unique.length) return new Map();

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('pms_issues')
    .select('issue_id, subject, status, is_closed, assignee, origin_site, updated_on')
    .in('issue_id', unique);

  // 캐시는 선택적이다. 실패해도 화면은 떠야 한다.
  if (error) {
    console.error('[pms/cache]', error.message);
    return new Map();
  }

  return new Map((data ?? []).map((row: any) => [row.issue_id as number, row as PmsIssueRow]));
}

/** DB 에 있는 모든 PMS 번호를 Redmine 에서 새로 받아 캐시에 채운다. */
export async function syncIssues(): Promise<{ fetched: number; failed: number }> {
  const supabase = createServerClient();

  const { data, error } = await supabase.from('deployment_pms_refs').select('pms_no');
  if (error) throw new Error(error.message);

  const ids = [...new Set((data ?? []).map((r: any) => r.pms_no as number))];
  let fetched = 0;
  let failed = 0;

  for (const id of ids) {
    const issue = await fetchIssue(id);
    if (!issue) {
      failed += 1;
      continue;
    }

    const { error: upsertError } = await supabase.from('pms_issues').upsert({
      issue_id: issue.issueId,
      subject: issue.subject,
      status: issue.status,
      is_closed: issue.isClosed,
      tracker: issue.tracker,
      priority: issue.priority,
      author: issue.author,
      assignee: issue.assignee,
      sw_version: issue.swVersion,
      xes_version: issue.xesVersion,
      origin_site: issue.originSite,
      created_on: issue.createdOn,
      updated_on: issue.updatedOn,
      closed_on: issue.closedOn,
      fetched_at: new Date().toISOString(),
    });

    if (upsertError) failed += 1;
    else fetched += 1;
  }

  return { fetched, failed };
}
```

- [ ] **Step 2: 동기화 라우트**

Create `app/api/pms/sync/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { verifyDashboardPassword } from '@/lib/dashboard-password';
import { syncIssues } from '@/lib/queries/pms';

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    if (!(await verifyDashboardPassword(String(password ?? '')))) {
      return NextResponse.json({ ok: false, message: '비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }

    const result = await syncIssues();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[pms/sync]', err);
    return NextResponse.json({ ok: false, message: 'PMS 동기화 실패' }, { status: 500 });
  }
}
```

- [ ] **Step 3: 타임라인에 PMS 정보 붙이기**

`app/site/[site]/[equipment]/page.tsx`에서 `getCachedIssues`를 불러 `DeploymentTimeline`에 넘긴다:

```tsx
import { getCachedIssues } from '@/lib/queries/pms';

// ... deployments 를 가져온 뒤
const pmsNumbers = deployments.flatMap((d) =>
  d.items.map((i) => i.pmsNo).filter((n): n is number => n != null)
);
const issues = await getCachedIssues(pmsNumbers);

// JSX
<DeploymentTimeline
  deployments={deployments}
  gaps={gaps}
  issues={Object.fromEntries(issues)}
/>
```

`components/history/deployment-timeline.tsx`의 props에 `issues: Record<number, PmsIssueRow>`를 추가하고 `<ItemDetail item={item} issue={issues[item.pms_no ?? -1]} />` 로 넘긴다.

`components/history/item-detail.tsx`의 시그니처를 바꾼다:

```tsx
import type { PmsIssueRow } from '@/lib/queries/pms';

export function ItemDetail({
  item,
  issue,
  siteName,
}: {
  item: DeploymentItemRow;
  issue?: PmsIssueRow;
  siteName: string;
}) {
```

그리고 PMS 번호 배지 블록 아래에 추가한다:

```tsx
{issue ? (
  <p className="mt-1 text-xs text-slate-500">
    {issue.status}
    {issue.assignee ? ` · ${issue.assignee}` : ''}
    {issue.originSite && issue.originSite !== siteName
      ? ` · 최초 발생 ${issue.originSite}`
      : ''}
  </p>
) : null}
```

`DeploymentTimeline`은 `siteName`을 `deployments[0].site`에서 얻어 넘긴다.
**`originSite`가 현재 사이트와 다를 때만 표시한다** — 같으면 노이즈다.

- [ ] **Step 4: 동기화 실행**

```bash
curl -X POST http://localhost:3000/api/pms/sync \
  -H "Content-Type: application/json" \
  -d '{"password":"<업로드 비밀번호>"}'
```

Expected: `{"ok":true,"fetched":<n>,"failed":<m>}`

- [ ] **Step 5: 화면 확인**

SDC A5 타임라인에서 `#4552` 항목에 `Closed` 상태와 `최초 발생 SDC A3` 이 보이는지 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add lib/queries/pms.ts app/api/pms components/history app/site
git commit -m "feat: enrich items with cached PMS issue status"
```

---

# Phase F — 정리

---

### Task 18: 구 코드와 구 테이블 제거

**이관과 화면이 전부 동작하는 것을 확인한 뒤에만 실행한다.**

**Files:**
- Delete: 아래 목록
- Modify: `package.json`, `supabase/schema.sql`
- Create: `supabase/drop-legacy.sql`

**Interfaces:**
- Consumes: 없음
- Produces: 없음

- [ ] **Step 1: 삭제 전 확인**

다음이 전부 참인지 확인한다. 하나라도 아니면 중단한다.

```bash
npm test            # 전부 통과
npm run build       # 성공
```

Supabase SQL Editor:

```sql
SELECT count(*) AS deployments FROM deployments;
SELECT count(*) AS items FROM deployment_items;
SELECT count(*) AS refs FROM deployment_pms_refs;
```

Expected: deployments ≥ 90, items ≥ 8, refs > 0

- [ ] **Step 2: 에디터·작성 API 삭제**

```bash
git rm -r "app/editor" "components/editor"
git rm -r "app/api/create-note" "app/api/delete-note" "app/api/list-notes" "app/api/load-note" "app/api/rename-note" "app/api/generate-docx" "app/api/test-save"
git rm -r "app/api/acquire-lock" "app/api/release-lock" "app/api/lock-status"
git rm "lib/lock-utils.ts" "lib/note-utils.ts"
```

`lib/note-utils.ts`는 위에서 지우는 note API 들과 `lock-utils.ts` 만 쓰던
파일이라 함께 사라져야 한다.

- [ ] **Step 3: 구 대시보드 삭제**

새 홈(`/`)이 설비 목록이므로 구 대시보드는 필요 없다.

`components/dashboard/` **전체를 지운다.** Task 11의 `equipment-summary-card`는
Park Systems 클래스(`park-navy`, `park-border`)를 직접 쓰고 이 디렉터리에서
아무것도 import 하지 않는다. `app/dashboard`와 `app/editor`가 사라지면 이
디렉터리 12개 파일은 전부 고아가 된다. 남겨두면 다음 사람이 어느 카드가
진짜인지 헷갈린다.

```bash
git rm -r "app/dashboard"
git rm -r "components/dashboard"
git rm "components/DashboardCard.tsx"
```

`components/forms/form-classes.ts`도 `components/editor/`만 쓰던 파일이라 함께 지운다:

```bash
git rm -r "components/forms"
```

- [ ] **Step 4: 리포지토리 쓰레기 정리**

```bash
git rm "DB BK.txt" "read me.txt" "page.tsx" "route.ts" "supabase.ts"
git rm "data/LGD AP4_EQ01.json"
git rm scripts/*.json
git rm "scripts/import-json-to-supabase.ts" "scripts/import_release_notes.cjs"
```

한글/URL인코딩 중복 파일은 이름 때문에 `git rm`이 까다로울 수 있다. 셸에서:

```bash
find . -maxdepth 3 -name "* - 복사본.*" -not -path "./node_modules/*" -print -delete
find . -maxdepth 3 -name "*#Ubcf5#Uc0ac#Ubcf8*" -not -path "./node_modules/*" -print -delete
```

- [ ] **Step 5: `package.json` 정리**

`dependencies`에서 `docx`, `jszip` 제거. `scripts`에서 `import-data` 제거.

```bash
npm uninstall docx jszip
```

- [ ] **Step 6: 빌드 확인**

```bash
npm run build
```

Expected: 성공. 실패하면 삭제한 파일을 참조하는 import가 남아 있는 것이다. 찾아서 고친다:

```bash
grep -rn "lock-utils\|generate-docx\|note-utils\|dashboard/types" app components lib --include="*.ts" --include="*.tsx"
```

- [ ] **Step 7: 구 테이블 DROP SQL 작성**

Create `supabase/drop-legacy.sql`:

```sql
-- ============================================================
-- 구 스키마 제거
-- 반드시 이관 검증이 끝난 뒤에 실행한다. 되돌릴 수 없다.
-- ============================================================

DROP FUNCTION IF EXISTS save_note(JSONB);
DROP FUNCTION IF EXISTS acquire_lock(TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS release_lock(TEXT, TEXT, TEXT);

DROP TABLE IF EXISTS overview_items;
DROP TABLE IF EXISTS detail_rows;
DROP TABLE IF EXISTS note_items;
DROP TABLE IF EXISTS history_rows;
DROP TABLE IF EXISTS edit_locks;
DROP TABLE IF EXISTS notes;

-- dashboard_settings 는 남긴다. 업로드 비밀번호가 여기 있다.
```

- [ ] **Step 8: 백업 후 DROP 실행**

Supabase 대시보드에서 데이터베이스 백업을 먼저 받는다. 그다음 SQL Editor에서 `drop-legacy.sql`을 실행한다.

확인:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

Expected: `dashboard_settings`, `deployment_alarms`, `deployment_items`, `deployment_pms_refs`, `deployments`, `pms_issues` — 6개

- [ ] **Step 9: 구 스키마 파일 정리**

`supabase/schema.sql`을 `supabase/schema-v1-archived.sql`로 이름만 바꾼다. 지우지 않는다 — 이관 결과를 나중에 대조할 일이 생긴다.

```bash
git mv supabase/schema.sql supabase/schema-v1-archived.sql
git rm supabase/fix_locks_and_duplicates.sql
```

- [ ] **Step 10: 문서 갱신**

`MEMORY.md`의 `## 현재 상태`를 "전환 완료. 운영 중"으로, `## 다음 할 일`을 비운다.
`ARCHITECTURE.md`의 「현재와의 차이」 절을 삭제한다 — 더 이상 차이가 없다.

- [ ] **Step 11: 전체 검증 후 커밋**

```bash
npm test
npm run build
git add -A
git commit -m "chore: remove release-note authoring code and legacy schema"
```

---

## 완료 기준

- [ ] `npm test` 전부 통과
- [ ] `npm run build` 성공
- [ ] `/` 에서 설비 5개가 현재 버전과 함께 보인다
- [ ] SDC A6 타임라인에 배포 58건이 최신순으로 보이고 끊김 구간이 표시된다
- [ ] `/search` 에서 `4952` 검색 시 SDC A5 결과가 나온다
- [ ] `/search` 에서 레거시 PMS 번호(예: `2932`) 검색 시 과거 배포가 나온다
- [ ] `docs/SDC_A5_Update_List.html` 업로드 시 항목 34건이 편집 가능하게 표시되고 저장된다
- [ ] `#4552` 항목에 `최초 발생 SDC A3` 이 보인다
- [ ] 구 테이블 6개가 DROP되고 `dashboard_settings` 는 남아 있다
