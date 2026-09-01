# SW 버전 이력 조회 도구 — 설계

작성일: 2026-09-01
상태: 승인됨 (구현 계획 대기)

## 배경

이 도구는 원래 **릴리즈 노트를 작성**하기 위해 만들어졌다. 설비별로 노트 1장을
편집하고 DOCX로 뽑는 구조였다.

그 목적이 사라졌다. 이제 유관부서(Digital R&D)가 SW 배포 시점에 적용 내역
문서를 직접 작성해서 전달한다. 우리가 쓸 일이 없다.

대신 새로 생긴 필요가 있다 — **사이트마다 지금 SW 버전이 몇이고, 각 버전에
어떤 기능·수정이 들어갔는지 찾아보는 것.** 문서는 계속 쌓이는데 흩어져 있어서
"#4952가 A5에 들어갔나?" 같은 질문에 답할 방법이 없다.

그래서 이 도구를 **작성 도구에서 조회 도구로** 전환한다.

## 목표

1. 사이트/설비를 고르면 배포 이력이 시간순으로 보인다. 각 배포에 버전 구간과
   그때 들어간 항목이 붙어 있다.
2. PMS 번호나 키워드로 검색하면 그 개선이 **어느 사이트 · 어느 버전 · 언제**
   들어갔는지 나온다.
3. 유관부서가 준 HTML 문서를 첨부하면 파싱해서 이력에 편입된다.
4. 기존에 누적된 이력(93건)이 그대로 살아 있다.

## 범위 밖

- 릴리즈 노트 작성 · DOCX 생성 — 제거한다.
- 설비별 노트 동시 편집 락 — 제거한다.
- 문서 원본을 만드는 기능 — 유관부서가 한다. 우리는 받아서 정리만 한다.

---

## 1. 데이터 모델

### 1.1 테이블

```
deployments                     배포 이벤트 1건 = 문서 1장
  id                uuid pk
  site              text        'SDC A5'
  equipment         text        'EQ01'
  model             text        'NX-TSH2225 #1'
  deployed_on       date
  xea_from_raw      text        원문 그대로. '5.2.5 Dev 907'
  xea_from_build    int  null   정규화. 907
  xea_to_raw        text
  xea_to_build      int  null
  xes_from_raw      text
  xes_from_build    int  null
  xes_to_raw        text
  xes_to_build      int  null
  cim_ver           text
  author            text
  source_kind       text        'html_upload' | 'legacy_json'
  source_file       text
  raw_html          text null   원문 통째. 재파싱용
  body_text         text        전문 검색용 통짜 텍스트
  edited_at         timestamptz null   사람이 손댔으면 기록
  created_at, updated_at

deployment_items                문서 안의 개별 개선 항목
  id                uuid pk
  deployment_id     uuid fk -> deployments (cascade)
  pms_no            int  null   4952. 역조회 1순위 키
  anchor_id         text        'p4952' / 'pjobresult'. pms_no 없을 때 안정 키
  section           text        'PMAC'
  section_no        int         4
  title             text
  phenomenon        text
  improvements      jsonb       [{component:'xea'|'xes', lines:[...]}]
  flags             text[]      ['site_requested','not_applied']
  body_text         text        전문 검색용
  sort_order        int

deployment_pms_refs             배포 <-> PMS 번호 링크 (레거시 포함)
  deployment_id     uuid fk
  pms_no            int
  source            text        'item' | 'legacy_text'
  pk (deployment_id, pms_no)

deployment_alarms               '신규 Alarm' 표
  id, deployment_id fk
  alarm_id          text        '20105'
  text              text
  pms_no            int null

pms_issues                      Redmine 캐시
  issue_id          int  pk
  subject, status, is_closed, tracker, priority
  author, assignee
  sw_version, xes_version       custom_fields에서
  origin_site       text        subject에서 추출. '[SDC A3] ...' -> 'SDC A3'
  created_on, updated_on, closed_on, fetched_at

dashboard_settings              유지. 업로드 비밀번호
```

### 1.2 설계 근거

**`raw_html`을 통째로 보관한다.** 파서를 나중에 고치거나 문서 틀이 바뀌었을 때
재업로드 없이 DB에서 재파싱할 수 있다. 저장 비용이 문서당 30KB 남짓이고,
틀 변경 가능성이 열려 있으므로 이 보험이 싸다.

**버전은 원문과 정규화값을 둘 다 둔다.** 누적 데이터의 버전 표기가 지저분하다:

```
5.2.5 Dev3592   5.2.5 3271   5.2.5 Dev 907   Dev635   -
(Dev3493 -> Dev3581)          5.2.5 Dev3389 XES 5.2.5 Dev1417
```

정렬·비교는 `*_build`(int)로, 표시는 `*_raw`로 한다. 파싱 실패는 `build = null`
이고 화면에서 "미상"으로 표시한다. 원문을 버리고 정규화값만 남기면 나중에
파서를 고쳐도 복구할 수 없다.

**레거시는 항목을 분해하지 않는다.** `history_rows.summary`는 여러 항목이 한
덩어리로 뭉친 텍스트라 신뢰할 만하게 쪼갤 수 없다. `deployments` 1건 +
`body_text`로만 남긴다. 예외로 SDC A5 최신 1건은 `xeaDetails`/`xesDetails`가
이미 항목별로 있으므로 정밀 이관한다.

**단, 레거시도 PMS 역조회에는 포함시킨다** — 1.3 참조.

### 1.3 레거시 PMS 역조회

레거시 요약 텍스트 93건 중 **48건에 `#숫자` 형태의 PMS 번호가 있고, 서로 다른
번호가 72개** 나온다. 이걸 버리면 "#2932가 언제 어디 들어갔나"에 답할 수 없다.

정규식으로 뽑아 `deployment_pms_refs`에 `source='legacy_text'`로 넣는다.
항목 본문은 여전히 분해하지 않으므로, 검색 결과에서 레거시 건은 "이 배포에
언급됨" 수준으로 표시하고 배포 요약 전문으로 연결한다.

**오탐은 Redmine API로 걸러낸다.** 뽑은 번호를 실제 조회해서 존재하지 않거나
무관한 프로젝트면 버린다. 72건 1회성 호출이라 비용이 없다.

---

## 2. 파서

### 2.1 원칙

`lib/parsers/update-list-html.ts` 한 파일. **HTML 문자열을 받아 순수 객체를
반환한다.** DB도 Next.js도 모른다. `docs/SDC_A5_Update_List.html`을 픽스처로
단위 테스트한다.

**절대 예외를 던지지 않는다.** 못 읽은 필드는 `null` + 경고 1건.
절반만 읽혀도 미리보기가 뜨고 사람이 채운다. 문서 틀이 바뀌면 경고가 대량으로
뜨는 것으로 즉시 드러난다.

정규식이 아니라 **CSS 선택자 기반 DOM 파싱**을 쓴다. 라이브러리는 `cheerio` —
서버 전용이고 가볍고 선택자 문법이 위 매핑 표와 1:1로 대응한다.

### 2.2 선택자 매핑

| 대상 | 선택자 | 비고 |
|---|---|---|
| 사이트·모델 | `.meta-grid .m` 중 `<b>설비</b>` | `SDC A5 / NX-TSH2225 #1` |
| XEA 버전 구간 | `<b>XEA</b>` | `Dev3592 → Dev4317` |
| XES 버전 구간 | `<b>XEService</b>` | |
| 작성자 | `<b>작성</b>` | |
| 배지 의미 | `section#s0 .legend div` | `.chip` 클래스 → 라벨. **문서에서 학습** |
| 섹션 | `section[id^=s] > h2.s` | `s0` 제외. `.n`=번호, 나머지=이름 |
| 항목 | `.item` | |
| PMS 번호 | `.item h3.s a.pms[href]` | href 끝 숫자가 정본. 복수면 배열 |
| 앵커 | `.item h3.s[id]` | `p4552` / `pjobresult` |
| 제목 | `h3.s`에서 링크·배지 제외 텍스트 | |
| 현상 | `.phen` (`<b>현상</b>` 제거) | |
| 개선 | `.grp.xea`/`.grp.xes` 다음 형제 `ul > li` | 컴포넌트별 묶음 |
| 플래그 | `h3.s .chip` 클래스 | legend 매핑 적용 |
| 신규 Alarm | `section > table` | `deployment_alarms`로 |

**배지 의미를 코드에 박지 않는다.** 섹션 0의 `.legend`가 그 문서에서
`.chip.a5` = "해당 사이트 요청", `.chip.prev` = "미적용분"임을 스스로
정의한다. legend에서 읽으면 다른 사이트 문서(`.chip.a6` 등)도 그대로 처리된다.

**PMS 번호가 없는 항목이 실제로 있다** (`#pjobresult` — "Job Result DB Loading
지연"). `pms_no`는 nullable이고 이때는 `anchor_id`를 안정 키로 쓴다.

### 2.3 문서는 하루치가 아니라 누적본이다

`SDC_A5_Update_List.html`은 `Dev3592 → Dev4317` 구간 전체를 담고, 그 안에
**아직 적용되지 않은 항목이 섞여 있다**(`6/29` 배지). 항목 단위로
`flags: ['not_applied']`를 두어 "적용됨 / 아직 안 들어감"을 구분한다.

---

## 3. 업로드 흐름

3단계. **마지막 단계에서만 DB에 쓴다.**

```
① 파일 드롭
     ↓
② 파싱 결과 미리보기 = 편집 가능한 초안 폼 (서버는 파싱만, 저장 안 함)
     ├ 헤더 메타: 사이트·설비·버전 구간        — 수정 가능
     ├ 항목 N건: 섹션/PMS/제목/현상/개선/플래그 — 수정 가능
     └ 경고 목록: "3번 섹션 2번째 항목에 PMS 번호 없음"
                  "XEA 버전에서 빌드 번호를 못 읽음"
     ↓
③ [확정 저장]
     → deployments + deployment_items + deployment_pms_refs
       + deployment_alarms + raw_html
```

**확정 시 저장되는 것은 파싱 원본이 아니라 사람이 손본 최종본이다.**
`raw_html`은 그와 별개로 그대로 남는다.

**함정**: 나중에 파서를 고쳐 `raw_html`을 재파싱하면 사람이 손본 내용이 날아간다.
편집이 발생한 배포는 `edited_at`을 남기고 재파싱 대상에서 기본 제외한다.
강제 재파싱 시 경고를 띄운다.

**중복 방지**: `(site, equipment, xea_to_build, xes_to_build)`가 같은 기존
배포가 있으면 미리보기에서 "이미 등록된 배포입니다 — 덮어쓸까요?"를 묻는다.
조용히 중복 생성하지 않는다.

---

## 4. 화면

| 경로 | 화면 | 내용 |
|---|---|---|
| `/` | 설비 목록 | 카드 = 현재 XEA/XES 버전 · 마지막 배포일 · **미적용 항목 수 배지** |
| `/site/[site]/[equipment]` | **사이트 타임라인** (메인) | 배포를 최신순 세로 타임라인. 날짜 · `Dev3592 → Dev4317` · 항목 수 · 섹션 칩. 펼치면 항목, 클릭하면 현상/개선 전문 |
| `/search` | **PMS·키워드 역조회** | `4952` 또는 `Fatal Following Error` → 항목 단위 결과. 각 결과에 사이트 / 버전 / 날짜 / 적용여부 |
| `/upload` | 업로드 + 미리보기 편집 | 3장 참조. 비밀번호 필요 |
| `/deployment/[id]` | 원문 보기 | 저장된 `raw_html`을 그대로 렌더 |

기존 `components/dashboard/`의 `equipment-card` · `stat-card` ·
`dashboard-toolbar` · `dashboard-toast`와 Park Systems 스타일은 재사용한다.

### 4.1 검색은 단순하게

배포 93건 + 항목 수백 건 규모에서 `pms_no` 정확 매칭 + `title`·`phenomenon`·
`body_text`에 대한 `ILIKE`면 충분하다. 한국어는 Postgres 전문검색 토크나이저가
약해서 `tsvector`를 붙여도 이득이 없고 복잡도만 는다.

**나중에 느려지면 그때 `pg_trgm` 인덱스를 단다.** 지금은 아니다.

### 4.2 타임라인의 끊김 표시

배포 A의 `xea_to_build`와 다음 배포 B의 `xea_from_build`가 안 맞으면
= 중간에 기록되지 않은 배포가 있다는 뜻이다. **끊김을 타임라인에 표시한다.**

레거시 데이터는 표기가 지저분해서 이게 꽤 나올 것이다. 숨기지 않는다.
"여기 기록이 비었다"는 이 도구가 알려줘야 할 정보다.

### 4.3 레거시 배포는 시각적으로 구분한다

항목이 분해되지 않은 통짜 요약이라 펼쳤을 때 모양이 다르다.
`source_kind='legacy_json'` 배지를 달아 "예전 기록이라 항목 단위 조회가
안 된다"를 명시한다. 사용자가 도구를 의심하게 두지 않는다.

---

## 5. PMS(Redmine) 연동

### 5.1 링크

파싱된 항목은 `a.pms[href]`에 정본 URL이 이미 있다. 번호만 있는 경우(레거시)는
`https://pms.parksystems.com/issues/{번호}`로 조립한다.

### 5.2 API 보강

`pms.parksystems.com`은 Redmine이다. `GET /issues/{id}.json`으로 다음을 얻는다:

```
subject, status(+is_closed), tracker, priority, author, assigned_to,
created_on, updated_on, closed_on,
custom_fields → 'Software Version', 'XEService Version'
```

**교차 사이트 추적이 여기서 나온다.** `#4552`는 SDC A5 배포 문서의 항목인데
PMS 제목은 `[SDC A3] ...`이다. A3에서 제기된 이슈의 수정이 A5에 들어갔다는
뜻이다. `subject`에서 `origin_site`를 뽑으면 "이 개선이 원래 어느 사이트에서
나왔는지"를 알 수 있다. HTML 문서만 봐서는 나오지 않는 정보다.

### 5.3 규칙

- **키는 서버 전용.** `process.env.PMS_API_KEY`. `NEXT_PUBLIC_` 접두사를
  절대 붙이지 않는다 — 붙이면 브라우저 번들에 실려 나간다.
  클라이언트는 항상 자체 `/api/pms/*`를 거친다.
- **캐시가 원칙, 실시간 조회 없음.** 화면마다 Redmine을 때리면 느리고 사내
  서버에 부담이다. 업로드 시점과 수동 "PMS 새로고침"에서만 동기화한다.
- **API가 죽어도 도구는 동작한다.** 보강 정보는 전부 선택적이다. 없으면
  링크와 문서 원문만 보여준다. PMS 연동이 조회의 전제 조건이 되면 안 된다.

---

## 6. 제거 대상

### 6.1 코드

```
app/editor/**                             에디터 전체
components/editor/**                      에디터 컴포넌트 전체
app/api/{create,load,delete,rename,list}-note/
app/api/generate-docx/
app/api/test-save/
app/api/{acquire,release}-lock/
app/api/lock-status/
lib/lock-utils.ts
```

### 6.2 리포지토리 정리

```
app/dashboard/page - 복사본.tsx           중복 파일 (URL인코딩 변종 포함)
app/api/load-note/route - 복사본.ts
lib/dashboard-password - 복사본.ts
루트의 page.tsx · route.ts · supabase.ts   app/·lib/에 정본이 있는 유령 파일
DB BK.txt · read me.txt
data/LGD AP4_EQ01.json                    LGD_AP4_EQ01.json과 내용 동일
scripts/*.json                            data/와 완전 중복
```

`scripts/import-json-to-supabase.ts`와 `scripts/import_release_notes.cjs`도
구 스키마 전용이므로 제거하고, `package.json`의 `import-data` 스크립트를
`migrate-legacy`로 교체한다. 의존성 `docx` · `jszip`을 빼고 `cheerio`를 넣는다.

### 6.3 DB

`notes` · `overview_items` · `detail_rows` · `note_items` · `history_rows` ·
`edit_locks`, RPC `save_note` · `acquire_lock` · `release_lock`.

**유지**: `dashboard_settings`. 조회는 누구나, **업로드만 비밀번호**로 막는다.
기존 해시와 검증 API를 그대로 쓴다.

---

## 7. 이관

`scripts/migrate-legacy.ts`. **몇 번을 돌려도 같은 결과가 되게(idempotent)**
만든다. 검증하다 고칠 일이 반드시 생긴다.

1. `data/*.json` 6개 로드. `LGD AP4_EQ01.json`(공백) 중복 제외 → 설비 5개
2. `history[]` 각 행 → `deployments` 1건.
   `source_kind='legacy_json'`, `body_text=summary`
3. 버전 정규화 `parseBuild()`:
   - `5.2.5 Dev3592` · `5.2.5 3271` · `5.2.5 Dev 907` · `Dev635`
     → `3592`, `3271`, `907`, `635`
   - `(Dev3493 -> Dev3581)` → from `3493`, to `3581`
   - `-` · 빈값 → `null` (미변경)
   - `5.2.5 Dev3389 XES 5.2.5 Dev1417` → **오염된 행.**
     `null` + 원문 보존 + 경고 로그
4. `summary`에서 `#숫자` 추출 → Redmine 검증 → `deployment_pms_refs`
5. SDC A5 최신 1건만 `xeaDetails`/`xesDetails` → `deployment_items` 정밀 이관
6. **검증 리포트를 콘솔에 출력**: 설비별 건수, 빌드번호 파싱 실패 건수,
   PMS 번호 검증 결과, 타임라인 끊김 구간

### 7.1 순서

```
새 스키마 생성 → 이관 실행 → 리포트 확인 → 화면 붙이기 → 마지막에 구 테이블 DROP
```

**구 테이블을 먼저 지우지 않는다.** 이관 결과가 틀렸을 때 돌아갈 곳이 있어야
한다.

### 7.2 기대 규모

| 설비 | 배포 건수 |
|---|---|
| SDC A6 | 58 |
| LGD AP3 | 23 |
| SDC A5 | 5 |
| LGD AP4 | 3 |
| LGD AP5 | 1 |
| **합계** | **93** |

PMS 번호 포함 배포 48건, 서로 다른 번호 72개.

---

## 8. 테스트

- **파서**: `docs/SDC_A5_Update_List.html`을 픽스처로 — 항목 수, PMS 번호,
  플래그, 버전 구간, 신규 Alarm 3건이 정확히 나오는지.
- **파서 견고성**: 헤더가 없는 HTML, 항목이 0개인 HTML, `.item` 구조가 깨진
  HTML을 넣어도 **예외 없이** 경고와 부분 결과를 반환하는지.
- **`parseBuild()`**: 위 6가지 표기 변종 전부.
- **이관 스크립트**: 두 번 돌려도 `deployments` 건수가 93 그대로인지.
- **검색**: PMS 번호 정확 매칭, 한글 키워드 부분 매칭.

## 9. 접근 제어

기존과 동일하게 간다 — **조회는 인증 없음, `/upload`만 비밀번호.**
`dashboard_settings`의 해시와 기존 검증 API를 그대로 쓴다.

이건 지금 도구가 사내에서 쓰이는 방식을 그대로 옮긴 것이지, 강한 보안 설계가
아니다. **공개 URL(Vercel 등)에 배포한다면 다시 봐야 한다** — 고객사 사이트명과
설비 정보가 조회 화면에 그대로 노출되기 때문이다. 배포 형태가 정해지면
`DECISIONS.md`에 결정을 남긴다.
