@AGENTS.md

# 이 프로젝트에서 일하는 법

**SW 버전 이력 조회 도구.** 사이트마다 지금 SW 버전이 몇이고, 각 버전에 어떤
개선이 들어갔는지 찾아보는 웹 도구다.

> [!important] 이 도구는 릴리즈 노트 **작성** 도구가 아니다
> 2026-09-01에 목적이 바뀌었다. 문서는 유관부서(Digital R&D)가 만들어서 준다.
> 우리는 **받아서 파싱하고 조회**만 한다. 작성·편집·DOCX 생성 기능을 되살리지 않는다.
> 배경은 [DECISIONS.md](./DECISIONS.md) 참조.

## 세션 시작할 때

1. [MEMORY.md](./MEMORY.md) — 지금 어디까지 왔고 다음에 뭘 할지
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — 구조가 필요할 때만
3. [DECISIONS.md](./DECISIONS.md) — "왜 이렇게 했지?"가 생겼을 때만

전체 설계는 `docs/superpowers/specs/2026-09-01-sw-version-history-design.md`에
있다. 한 번 읽으면 충분하고, 세션마다 열지 않는다.

## 세션 끝낼 때

`MEMORY.md`의 `## 현재 상태`와 `## 다음 할 일`을 갱신한다. 결정을 내렸으면
그 자리에서 `DECISIONS.md`에 적는다. 세션 끝까지 미루면 잊는다.

## 명령어

```bash
npm run dev          # 개발 서버
npm run build        # 빌드 (커밋 전 반드시 통과시킬 것)
npm run lint
```

## 환경 변수

`.env.local.example`을 복사해서 `.env.local`을 만든다. `.gitignore`가 `.env*`를
막고 있다.

> [!warning] 비밀키에 `NEXT_PUBLIC_` 을 붙이지 말 것
> 붙이면 브라우저 번들에 그대로 실려 나간다. `SUPABASE_SERVICE_ROLE_KEY`와
> `PMS_API_KEY`는 **서버 전용**이다. 클라이언트는 항상 자체 `/api/*`를 거친다.

**API 키·토큰을 어떤 md 파일에도 적지 않는다.** 이 폴더는 OneDrive로 동기화되고
git 히스토리에도 남는다. 문서에는 환경변수 **이름만** 쓴다.

## 코드 규칙

- **파서는 순수 함수다.** `lib/parsers/`는 HTML 문자열을 받아 객체를 반환한다.
  DB도 Next.js도 모른다. 그래야 픽스처로 테스트할 수 있다.
- **파서는 예외를 던지지 않는다.** 못 읽은 필드는 `null` + 경고 1건. 절반만
  읽혀도 화면이 뜨고 사람이 채운다.
- **버전 문자열은 원문을 버리지 않는다.** `*_raw`와 `*_build`를 둘 다 저장한다.
  정렬은 `build`로, 표시는 `raw`로.
- **검색은 `ILIKE`로 충분하다.** 배포 100건 규모다. `tsvector`는 한국어에서
  이득이 없다. 느려지면 그때 `pg_trgm`을 단다.
- 기존 `components/history/`, `components/upload/`와 `app/globals.css`의
  Park Systems 스타일 토큰(`park-navy`, `park-border`)을 재사용한다. 새로 만들기
  전에 먼저 있는지 본다.

## 함정

- **Next.js 16이다.** 학습 데이터의 Next.js와 다르다. `AGENTS.md`가 시키는 대로
  `node_modules/next/dist/docs/`를 먼저 읽는다.
- **파일명에 한글·공백이 섞인 잔재가 있다.** `page - 복사본.tsx` 같은 중복 파일과
  루트에 떠 있는 유령 `page.tsx`·`route.ts`·`supabase.ts`는 정본이 아니다.
  spec 6.2의 정리 대상이다. **이것들을 고치지 말고 지운다.**
- **누적 데이터의 버전 표기가 지저분하다.** `5.2.5 Dev 907`, `(Dev3493 -> Dev3581)`,
  `5.2.5 Dev3389 XES 5.2.5 Dev1417`, `-`. 정규화 실패를 조용히 삼키지 말고
  경고로 드러낸다.
- **구 테이블(`notes` 등)을 이관 검증 전에 DROP하지 않는다.** 돌아갈 곳이
  있어야 한다.

## 하지 말 것

- 승인 없이 DB 테이블 DROP
- 승인 없이 파일 대량 삭제 — spec에 목록이 있어도 실행 전에 확인
- 요청 없이 커밋·푸시
- 에디터·DOCX 기능 부활
