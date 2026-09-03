# 아키텍처

> 상태: **전환 완료.** 아래는 현재 구조다.

## 한 줄

유관부서가 준 SW 배포 문서(HTML)를 파싱해 DB에 이력으로 쌓고, 사이트별
타임라인과 PMS 번호 역조회로 꺼내 보는 Next.js + Supabase 웹앱.

## 전체 흐름

```
유관부서 HTML 문서
      │  ① 업로드
      ▼
 lib/parsers/update-list-html.ts        순수 함수. HTML -> 객체 + 경고[]
      │  ② 파싱 결과 = 편집 가능한 초안
      ▼
 /upload 미리보기 화면                   사람이 헤더·항목 텍스트를 손봄
      │  ③ 확정
      ▼
 Supabase (Postgres)
   deployments ─┬─ deployment_items ─── deployment_pms_refs ─┐
                ├─ deployment_alarms                          │
                └─ raw_html (원문 보존)                        │
                                          pms_issues (Redmine 캐시) ◄┘
      │
      ▼
 조회 화면   /  ·  /site/[site]/[equipment]  ·  /search  ·  /deployment/[id]
```

## 레이어 경계

| 레이어 | 위치 | 아는 것 / 모르는 것 |
|---|---|---|
| 파서 | `lib/parsers/` | HTML만 안다. **DB·Next.js를 모른다.** 순수 함수 |
| 버전 정규화 | `lib/version.ts` | 문자열만 안다. `parseBuild()` |
| 데이터 접근 | `lib/queries/` | Supabase를 안다. React를 모른다 |
| API 라우트 | `app/api/` | 비밀키를 아는 **유일한** 곳 |
| 화면 | `app/`, `components/` | 비밀키를 모른다. 항상 `/api/*`를 거친다 |

이 경계가 이 프로젝트의 핵심이다. 특히 **파서를 순수하게 유지하는 것** —
그래야 `docs/SDC_A5_Update_List.html`을 픽스처로 테스트할 수 있고, 문서 틀이
바뀌었을 때 파서만 고쳐서 `raw_html`을 재파싱할 수 있다.

## 데이터 모델 요약

전체 정의는 spec 1장. 요점만:

- **`deployments`** — 배포 이벤트 1건 = 문서 1장. 버전 구간(`xea_from`→`xea_to`)과
  `raw_html`을 갖는다.
- **`deployment_items`** — 문서 안의 개별 개선 항목. `pms_no`가 역조회 1순위 키.
- **`deployment_pms_refs`** — 배포↔PMS 링크. 레거시 배포도 여기로 역조회에 참여한다.
- **`pms_issues`** — Redmine 캐시. 없어도 도구는 동작한다.

### 두 종류의 배포가 섞여 있다

| | `source_kind='html_upload'` | `source_kind='legacy_json'` |
|---|---|---|
| 출처 | 유관부서 HTML | 기존 `data/*.json`의 `history[]` |
| 항목 분해 | 됨 (`deployment_items`) | 안 됨 (`body_text` 통짜) |
| PMS 역조회 | 항목 단위로 정확 | 텍스트에서 추출, 배포 단위 |
| 건수 | 앞으로 쌓임 | 90건 (고정) |

화면에서 이 둘을 **시각적으로 구분한다.** 레거시를 항목 있는 것처럼 보이게
꾸미지 않는다. 사용자가 도구를 의심하게 두면 안 된다.

## 화면

| 경로 | 역할 |
|---|---|
| `/` | 설비 목록. 현재 버전 · 마지막 배포일 · 미적용 항목 수 |
| `/site/[site]/[equipment]` | **메인.** 배포 타임라인. 버전 끊김 표시 |
| `/search` | PMS 번호 · 키워드 역조회 |
| `/upload` | 업로드 + 미리보기 편집. 비밀번호 필요 |
| `/deployment/[id]` | `raw_html` 원문 렌더 |

`/upload`만 쓰기다. 나머지는 전부 읽기 전용이다.

## 외부 의존

- **Supabase** — Postgres. RLS는 현재 비활성(Phase 1).
- **Redmine** (`pms.parksystems.com`) — `GET /issues/{id}.json`.
  **선택적 의존이다.** 죽어도 조회 기능은 전부 동작한다. 캐시만 늙는다.
