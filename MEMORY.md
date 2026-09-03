# 작업 기억

세션 시작에 이 파일부터 읽는다. 세션 끝에 `현재 상태`와 `다음 할 일`을 갱신한다.

updated: 2026-09-03

---

## 현재 상태

**구현 완료. PR 대기.** 브랜치 `feature/sw-version-history` 원격에 푸시됨 (`1b69473`).
`origin/main` 위 커밋 38개.

```
tsc     0 errors
tests   88 passing (7 files)
build   성공
DB      배포 90 · 항목 8 · PMS 참조 145 · 캐시 73
```

18개 태스크 전부 리뷰 승인. 최종 전체 브랜치 리뷰가 차단 6건(태스크 간 이음매)을
찾아 일괄 수정했고 재리뷰에서 "Ready to merge" 판정.

PR 본문 초안: `.superpowers/sdd/2026-09-01-sw-version-history/PR-BODY.md`
작업 기록 전문(판단 19건 · 이월 minor 21건): 같은 폴더의 `progress.md`

## 다음 할 일

1. PR 생성 → 병합
2. 병합 후 `backup/sw-version-history-prerebase` 정리
3. 운영 후 구 DB 테이블 6개 DROP 판단 (지금은 유지 — 사용자 결정)

## 남겨둔 한계 (PR 본문에도 명시)

- `/api/pms/sync` 가 무제한 비밀번호 검사. 삭제한 죽은 라우트와 같은 패턴이나
  정당한 호출자가 있어 범위 밖으로 뒀다. 후속 검토 필요
- 업로드 비밀번호가 `dashboard_settings` 에 평문 저장되고 해시보다 우선한다.
  로그인 테스트 불가 상태에서 자격증명 처리를 바꾸면 업로드가 막힐 위험이 있어 유지
- `insertDeployment` 의 자식 행 교체가 트랜잭션이 아니다. 커밋 라우트 입력 검증으로
  알려진 경로는 막았으나 원자성은 Postgres 함수가 필요
- 조회 화면 무인증. 공개 URL 배포 시 고객사 사이트명 노출

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
