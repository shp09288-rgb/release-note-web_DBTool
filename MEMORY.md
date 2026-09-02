# 작업 기억

세션 시작에 이 파일부터 읽는다. 세션 끝에 `현재 상태`와 `다음 할 일`을 갱신한다.

updated: 2026-09-01

---

## 현재 상태

**Phase A·B 코드 완료, Phase C 진행 중.** 브랜치 `feature/sw-version-history`,
`origin/main` 위에 커밋 24개. 테스트 70개 통과, 빌드 통과.

동작하는 것: 파서(항목 34건·알람 3건 추출), 버전 정규화, Redmine 클라이언트,
쿼리 레이어, 끊김 계산, 그리고 화면 3개(설비 목록·타임라인·검색).

| 태스크 | 상태 |
|---|---|
| 1–8, 10–13 | 완료 (리뷰 승인) |
| 14 원문 보기 | 진행 중 |
| **9 이관 90건** | **DB 프로비저닝 대기** |
| 15–18 | DB 대기 |

## 막혀 있는 것 — 사람이 해야 함

1. `supabase/schema-v2.sql` 을 Supabase SQL Editor 에서 실행 (새 테이블 5개 추가만)
2. `.env.local` 생성 — Supabase URL·anon·service_role, PMS_API_KEY, PMS_BASE_URL
3. `git push -u origin feature/sw-version-history` — 이 환경에 GitHub 자격증명 없음

셋 다 되면 Task 9·15·16·17 이 한 번에 풀린다.

## 리베이스 이력

로컬 리포는 GitHub 리포의 클론이 아니라 별도 `git init` 이었고 공통 조상이 없었다.
로컬에 없던 4,326줄(release-note-bulk-parser, document-model, components/ui/* 등)이
원격에 있었다. 2026-09-01 에 `git rebase --onto origin/main 46e8f46` 으로 정리했고
충돌 0건. 백업 브랜치: `backup/sw-version-history-prerebase`.

## 확인된 사실

기억해 둘 만한, 코드를 봐서는 안 나오는 것들.

- **누적 배포 90건**: SDC A6 58 / LGD AP3 23 / SDC A5 5 / LGD AP4 3 / LGD AP5 1
  (중복 파일 제외 후. 93은 `LGD AP4` 3건을 두 번 센 값이었다)
- `data/LGD AP4_EQ01.json`(공백)과 `data/LGD_AP4_EQ01.json`은 **내용이 같다.**
  이관 시 하나만 쓴다.
- 레거시 요약 90건 중 **46건에 PMS 번호**가 텍스트로 들어 있다. 서로 다른 번호 72개.
- `docs/SDC_A5_Update_List.html`은 **하루치가 아니라 누적 문서**다.
  `Dev3592 → Dev4317` 구간이고 미적용 항목이 섞여 있다.
- 이 문서에는 PMS 번호가 **없는 항목도 있다** (`#pjobresult`).
- Redmine API 동작 확인됨 (`GET /issues/{id}.json`). custom field에
  `Software Version`, `XEService Version`이 있다.
- `#4552`는 A5 문서 항목인데 PMS 제목은 `[SDC A3]`다 → 교차 사이트 추적 가능.

## 함정

- **Next.js 16**. 학습 데이터와 다르다. `node_modules/next/dist/docs/`를 먼저 읽는다.
- 파일명에 한글·공백이 섞인 중복 파일과 루트 유령 파일이 있다. 고치지 말고 지운다
  (spec 6.2).
- **구 테이블을 이관 검증 전에 DROP하지 않는다.**
- 이 폴더는 OneDrive 동기화 중이다. **API 키를 md에 적지 않는다.**

## 시도했다 접은 것

`DECISIONS.md`에 근거와 함께 있다. 요약:

- 새 프로젝트로 신규 구축 → 재사용할 게 많아서 손해
- 기존 `notes` 스키마에 이력 얹기 → `UNIQUE(site, equipment)`와 정면 충돌
- 레거시 요약을 항목으로 쪼개기 → 신뢰할 수 없음. 통짜 + PMS 번호 추출로 타협
