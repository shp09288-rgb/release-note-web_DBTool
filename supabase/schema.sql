-- ============================================================
-- Release Note Web — Supabase DB Schema
-- Supabase SQL Editor에 그대로 붙여넣기 후 실행
-- ============================================================

-- UUID 함수 활성화 (Supabase 기본 제공)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. notes
--    site + equipment 조합은 유일 (UNIQUE 제약)
--    rename 시 site / equipment 컬럼 UPDATE
--    delete 시 자식 테이블 CASCADE
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  site        TEXT        NOT NULL,
  equipment   TEXT        NOT NULL,
  date        TEXT        NOT NULL DEFAULT '',
  xea_before  TEXT        NOT NULL DEFAULT '',
  xea_after   TEXT        NOT NULL DEFAULT '',
  xes_before  TEXT        NOT NULL DEFAULT '',
  xes_after   TEXT        NOT NULL DEFAULT '',
  cim_ver     TEXT        NOT NULL DEFAULT '',
  updated_by  TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT notes_pkey        PRIMARY KEY (id),
  CONSTRAINT notes_site_eq_key UNIQUE      (site, equipment)
);

-- ============================================================
-- 2. overview_items
--    Release Overview 항목 (순서 보장: sort_order)
-- ============================================================
CREATE TABLE IF NOT EXISTS overview_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  note_id     UUID        NOT NULL,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  text        TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT overview_items_pkey    PRIMARY KEY (id),
  CONSTRAINT overview_items_note_fk FOREIGN KEY (note_id)
    REFERENCES notes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ============================================================
-- 3. detail_rows
--    XEA / XES / Test Versions 공통 상세 행
--    type: 'xea' | 'xes' | 'test'
-- ============================================================
CREATE TABLE IF NOT EXISTS detail_rows (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  note_id     UUID        NOT NULL,
  type        TEXT        NOT NULL DEFAULT 'xea',
  ref         TEXT        NOT NULL DEFAULT '',
  category    TEXT        NOT NULL DEFAULT '',
  title       TEXT        NOT NULL DEFAULT '',
  "desc"      TEXT        NOT NULL DEFAULT '',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT detail_rows_pkey    PRIMARY KEY (id),
  CONSTRAINT detail_rows_note_fk FOREIGN KEY (note_id)
    REFERENCES notes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT detail_rows_type_check CHECK (type IN ('xea', 'xes', 'test'))
);

-- ============================================================
-- 4. note_items
--    Important Notes 항목
--    icon: '!' (경고) | 'i' (정보)
-- ============================================================
CREATE TABLE IF NOT EXISTS note_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  note_id     UUID        NOT NULL,
  icon        TEXT        NOT NULL DEFAULT '!',
  text        TEXT        NOT NULL DEFAULT '',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT note_items_pkey    PRIMARY KEY (id),
  CONSTRAINT note_items_note_fk FOREIGN KEY (note_id)
    REFERENCES notes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT note_items_icon_check CHECK (icon IN ('!', 'i'))
);

-- ============================================================
-- 5. history_rows
--    SW Update History 행 (최신이 sort_order 0)
-- ============================================================
CREATE TABLE IF NOT EXISTS history_rows (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  note_id     UUID        NOT NULL,
  date        TEXT        NOT NULL DEFAULT '',
  xea         TEXT        NOT NULL DEFAULT '',
  xes         TEXT        NOT NULL DEFAULT '',
  cim         TEXT        NOT NULL DEFAULT '',
  summary     TEXT        NOT NULL DEFAULT '',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT history_rows_pkey    PRIMARY KEY (id),
  CONSTRAINT history_rows_note_fk FOREIGN KEY (note_id)
    REFERENCES notes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ============================================================
-- 6. edit_locks
--    동시 편집 방지용 락 테이블
--    site + equipment 조합은 유일 (한 노트에 락 하나)
--    stale 판정: updated_at 기준 10시간 경과
-- ============================================================
CREATE TABLE IF NOT EXISTS edit_locks (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  site        TEXT        NOT NULL,
  equipment   TEXT        NOT NULL,
  user_name   TEXT        NOT NULL DEFAULT '',
  locked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 hours'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT edit_locks_pkey        PRIMARY KEY (id),
  CONSTRAINT edit_locks_site_eq_key UNIQUE      (site, equipment)
);

-- ============================================================
-- 인덱스
-- ============================================================

-- overview_items
CREATE INDEX IF NOT EXISTS idx_overview_items_note_id
  ON overview_items (note_id);

CREATE INDEX IF NOT EXISTS idx_overview_items_note_order
  ON overview_items (note_id, sort_order);

-- detail_rows
CREATE INDEX IF NOT EXISTS idx_detail_rows_note_id
  ON detail_rows (note_id);

CREATE INDEX IF NOT EXISTS idx_detail_rows_note_type_order
  ON detail_rows (note_id, type, sort_order);

-- note_items
CREATE INDEX IF NOT EXISTS idx_note_items_note_id
  ON note_items (note_id);

CREATE INDEX IF NOT EXISTS idx_note_items_note_order
  ON note_items (note_id, sort_order);

-- history_rows
CREATE INDEX IF NOT EXISTS idx_history_rows_note_id
  ON history_rows (note_id);

CREATE INDEX IF NOT EXISTS idx_history_rows_note_order
  ON history_rows (note_id, sort_order);

-- edit_locks
CREATE INDEX IF NOT EXISTS idx_edit_locks_site_equipment
  ON edit_locks (site, equipment);

CREATE INDEX IF NOT EXISTS idx_edit_locks_expires_at
  ON edit_locks (expires_at);

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_updated_at
  ON notes (updated_at DESC);

-- ============================================================
-- Row Level Security — Phase 1: 비활성화
-- 모든 API 요청은 서버 측 Service Role Key 사용 (RLS 우회)
-- Phase 2에서 아래 [Phase 2 RLS] 섹션을 실행하여 활성화
-- ============================================================
ALTER TABLE notes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE overview_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE detail_rows    DISABLE ROW LEVEL SECURITY;
ALTER TABLE note_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE history_rows   DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_locks     DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- [Phase 2 RLS] — 아래는 Phase 2에서 별도 실행
-- ============================================================
--
-- Step 1: RLS 활성화
-- ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE overview_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE detail_rows    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE note_items     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE history_rows   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE edit_locks     ENABLE ROW LEVEL SECURITY;
--
-- Step 2: notes 정책 (예시)
-- CREATE POLICY "notes_select_all"
--   ON notes FOR SELECT USING (true);
--
-- CREATE POLICY "notes_insert_authenticated"
--   ON notes FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');
--
-- CREATE POLICY "notes_update_authenticated"
--   ON notes FOR UPDATE
--   USING (auth.role() = 'authenticated');
--
-- CREATE POLICY "notes_delete_admin"
--   ON notes FOR DELETE
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_id = auth.uid()
--         AND role = 'admin'
--     )
--   );
--
-- Step 3: 자식 테이블 정책 (notes와 동일 패턴)
-- CREATE POLICY "child_select_all"
--   ON overview_items FOR SELECT USING (true);
-- -- (detail_rows / note_items / history_rows 동일)
--
-- Step 4: edit_locks 정책
-- CREATE POLICY "locks_select_all"
--   ON edit_locks FOR SELECT USING (true);
-- CREATE POLICY "locks_write_authenticated"
--   ON edit_locks FOR ALL
--   USING (auth.role() = 'authenticated');
--
-- ============================================================
-- [Phase 2 Audit Log] — 선택적 추가 테이블
-- ============================================================
--
-- CREATE TABLE IF NOT EXISTS note_audit_logs (
--   id          UUID        NOT NULL DEFAULT gen_random_uuid(),
--   note_id     UUID        REFERENCES notes (id) ON DELETE SET NULL,
--   action      TEXT        NOT NULL,   -- 'create' | 'update' | 'delete' | 'rename'
--   actor_id    UUID,                   -- auth.uid()
--   actor_name  TEXT        NOT NULL DEFAULT '',
--   site        TEXT        NOT NULL DEFAULT '',
--   equipment   TEXT        NOT NULL DEFAULT '',
--   payload     JSONB,
--   created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
--
--   CONSTRAINT note_audit_logs_pkey PRIMARY KEY (id)
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_note_id
--   ON note_audit_logs (note_id);
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id
--   ON note_audit_logs (actor_id);
-- CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
--   ON note_audit_logs (created_at DESC);
