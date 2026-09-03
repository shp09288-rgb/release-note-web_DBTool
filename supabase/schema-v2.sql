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
