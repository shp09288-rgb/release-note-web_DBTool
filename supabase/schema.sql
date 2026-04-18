-- ============================================================
-- Release Note Web - Supabase DB Schema
-- Supabase SQL Editor에 바로 붙여넣기 가능
-- ============================================================

-- UUID 생성 확장 (Supabase 기본 활성화되어 있음)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. 메인 노트 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  site        TEXT        NOT NULL,
  equipment   TEXT        NOT NULL,
  date        TEXT        DEFAULT '',
  xea_before  TEXT        DEFAULT '',
  xea_after   TEXT        DEFAULT '',
  xes_before  TEXT        DEFAULT '',
  xes_after   TEXT        DEFAULT '',
  cim_ver     TEXT        DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  TEXT        DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site, equipment)
);

-- ============================================================
-- 2. Release Overview 항목
-- ============================================================
CREATE TABLE IF NOT EXISTS overview_items (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id     UUID    NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  text        TEXT    DEFAULT ''
);

-- ============================================================
-- 3. System Detail 행 (XEA / XES / Test Versions 공통)
-- type: 'xea' | 'xes' | 'test'
-- ============================================================
CREATE TABLE IF NOT EXISTS detail_rows (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id     UUID    NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  type        TEXT    NOT NULL DEFAULT 'xea',
  ref         TEXT    DEFAULT '',
  category    TEXT    DEFAULT '',
  title       TEXT    DEFAULT '',
  "desc"      TEXT    DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 4. Important Notes 항목
-- icon: '!' (경고) | 'i' (정보)
-- ============================================================
CREATE TABLE IF NOT EXISTS note_items (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id     UUID    NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  icon        TEXT    DEFAULT '!',
  text        TEXT    DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 5. SW Update History 행
-- ============================================================
CREATE TABLE IF NOT EXISTS history_rows (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id     UUID    NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  date        TEXT    DEFAULT '',
  xea         TEXT    DEFAULT '',
  xes         TEXT    DEFAULT '',
  cim         TEXT    DEFAULT '',
  summary     TEXT    DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 6. 편집 락 테이블 (동시 편집 방지)
-- ============================================================
CREATE TABLE IF NOT EXISTS edit_locks (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  site        TEXT        NOT NULL,
  equipment   TEXT        NOT NULL,
  user_name   TEXT        NOT NULL,
  locked_at   TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ DEFAULT (now() + INTERVAL '10 hours'),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site, equipment)
);

-- ============================================================
-- 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_overview_items_note_id   ON overview_items(note_id);
CREATE INDEX IF NOT EXISTS idx_detail_rows_note_id      ON detail_rows(note_id);
CREATE INDEX IF NOT EXISTS idx_detail_rows_note_type    ON detail_rows(note_id, type);
CREATE INDEX IF NOT EXISTS idx_note_items_note_id       ON note_items(note_id);
CREATE INDEX IF NOT EXISTS idx_history_rows_note_id     ON history_rows(note_id);
CREATE INDEX IF NOT EXISTS idx_edit_locks_site_eq       ON edit_locks(site, equipment);

-- ============================================================
-- Row Level Security (Phase 1: 비활성화)
-- Phase 2에서 Supabase Auth + RLS 정책으로 고도화 예정
-- ============================================================
ALTER TABLE notes         DISABLE ROW LEVEL SECURITY;
ALTER TABLE overview_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE detail_rows   DISABLE ROW LEVEL SECURITY;
ALTER TABLE note_items    DISABLE ROW LEVEL SECURITY;
ALTER TABLE history_rows  DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_locks    DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- [Phase 2 미리보기] - 지금은 실행하지 않음
-- ============================================================
-- Phase 2에서 아래를 실행하여 RLS 활성화 + 정책 추가:
--
-- ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "anyone_read" ON notes FOR SELECT USING (true);
-- CREATE POLICY "auth_write"  ON notes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "auth_update" ON notes FOR UPDATE USING (auth.role() = 'authenticated');
-- CREATE POLICY "admin_delete" ON notes FOR DELETE USING (
--   auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
-- );
--
-- audit log 테이블 (Phase 2 선택적 추가):
-- CREATE TABLE IF NOT EXISTS note_audit_logs (
--   id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
--   note_id    UUID        REFERENCES notes(id),
--   action     TEXT        NOT NULL,  -- 'create' | 'update' | 'delete' | 'rename'
--   actor_id   UUID,                  -- auth.uid()
--   actor_name TEXT        DEFAULT '',
--   changed_at TIMESTAMPTZ DEFAULT now(),
--   payload    JSONB
-- );
