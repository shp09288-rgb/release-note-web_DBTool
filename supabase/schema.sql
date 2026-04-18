-- ============================================================
-- Release Note Web — Supabase DB Schema
-- Supabase SQL Editor에 전체 복사 후 실행
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- updated_at 자동 갱신 함수 / 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. notes
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
  CONSTRAINT notes_site_eq_key UNIQUE (site, equipment)
);

CREATE OR REPLACE TRIGGER trg_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. overview_items
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

CREATE OR REPLACE TRIGGER trg_overview_items_updated_at
  BEFORE UPDATE ON overview_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. detail_rows  (type: 'xea' | 'xes' | 'test')
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

  CONSTRAINT detail_rows_pkey       PRIMARY KEY (id),
  CONSTRAINT detail_rows_note_fk    FOREIGN KEY (note_id)
    REFERENCES notes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT detail_rows_type_check CHECK (type IN ('xea', 'xes', 'test'))
);

CREATE OR REPLACE TRIGGER trg_detail_rows_updated_at
  BEFORE UPDATE ON detail_rows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. note_items  (icon: '!' | 'i')
-- ============================================================
CREATE TABLE IF NOT EXISTS note_items (
  id          UUID        NOT NULL DEFAULT gen_random_uuid(),
  note_id     UUID        NOT NULL,
  icon        TEXT        NOT NULL DEFAULT '!',
  text        TEXT        NOT NULL DEFAULT '',
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT note_items_pkey      PRIMARY KEY (id),
  CONSTRAINT note_items_note_fk   FOREIGN KEY (note_id)
    REFERENCES notes (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT note_items_icon_check CHECK (icon IN ('!', 'i'))
);

CREATE OR REPLACE TRIGGER trg_note_items_updated_at
  BEFORE UPDATE ON note_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. history_rows
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

CREATE OR REPLACE TRIGGER trg_history_rows_updated_at
  BEFORE UPDATE ON history_rows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. edit_locks
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
  CONSTRAINT edit_locks_site_eq_key UNIQUE (site, equipment)
);

CREATE OR REPLACE TRIGGER trg_edit_locks_updated_at
  BEFORE UPDATE ON edit_locks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 인덱스
-- ============================================================

-- notes
CREATE INDEX IF NOT EXISTS idx_notes_updated_at
  ON notes (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_site_equipment
  ON notes (site, equipment);

-- overview_items
CREATE INDEX IF NOT EXISTS idx_overview_items_note_id
  ON overview_items (note_id);

CREATE INDEX IF NOT EXISTS idx_overview_items_note_order
  ON overview_items (note_id, sort_order ASC);

-- detail_rows
CREATE INDEX IF NOT EXISTS idx_detail_rows_note_id
  ON detail_rows (note_id);

CREATE INDEX IF NOT EXISTS idx_detail_rows_note_type_order
  ON detail_rows (note_id, type, sort_order ASC);

-- note_items
CREATE INDEX IF NOT EXISTS idx_note_items_note_id
  ON note_items (note_id);

CREATE INDEX IF NOT EXISTS idx_note_items_note_order
  ON note_items (note_id, sort_order ASC);

-- history_rows
CREATE INDEX IF NOT EXISTS idx_history_rows_note_id
  ON history_rows (note_id);

CREATE INDEX IF NOT EXISTS idx_history_rows_note_order
  ON history_rows (note_id, sort_order ASC);

-- edit_locks
CREATE INDEX IF NOT EXISTS idx_edit_locks_site_equipment
  ON edit_locks (site, equipment);

CREATE INDEX IF NOT EXISTS idx_edit_locks_expires_at
  ON edit_locks (expires_at ASC);

-- ============================================================
-- save_note — 단일 트랜잭션으로 노트 전체 저장
--
-- PL/pgSQL 함수 내 모든 문장은 하나의 트랜잭션으로 실행됨.
-- 중간 실패 시 Postgres가 전체 롤백 → 데이터 불일치 방지.
--
-- Supabase SQL Editor에서 한 번 실행 후 사용 가능.
-- API 호출: supabase.rpc('save_note', { p_site, ... })
-- ============================================================
CREATE OR REPLACE FUNCTION save_note(
  p_site          TEXT,
  p_equipment     TEXT,
  p_date          TEXT,
  p_xea_before    TEXT,
  p_xea_after     TEXT,
  p_xes_before    TEXT,
  p_xes_after     TEXT,
  p_cim_ver       TEXT,
  p_updated_by    TEXT,
  p_overview      JSONB,      -- [{"text":"..."}]
  p_xea_details   JSONB,      -- [{"ref":"...","category":"...","title":"...","desc":"..."}]
  p_xes_details   JSONB,
  p_test_versions JSONB,
  p_note_items    JSONB,      -- [{"icon":"!","text":"..."}]
  p_history       JSONB       -- [{"date":"...","xea":"...","xes":"...","cim":"...","summary":"..."}]
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_note_id UUID;
BEGIN
  -- ① notes upsert — created_at은 건드리지 않음
  INSERT INTO notes (
    site, equipment, date,
    xea_before, xea_after,
    xes_before, xes_after,
    cim_ver, updated_by, updated_at
  )
  VALUES (
    p_site, p_equipment, p_date,
    p_xea_before, p_xea_after,
    p_xes_before, p_xes_after,
    p_cim_ver, p_updated_by, now()
  )
  ON CONFLICT (site, equipment) DO UPDATE SET
    date       = EXCLUDED.date,
    xea_before = EXCLUDED.xea_before,
    xea_after  = EXCLUDED.xea_after,
    xes_before = EXCLUDED.xes_before,
    xes_after  = EXCLUDED.xes_after,
    cim_ver    = EXCLUDED.cim_ver,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING id INTO v_note_id;

  -- ② 기존 자식 행 전체 삭제
  DELETE FROM overview_items WHERE note_id = v_note_id;
  DELETE FROM detail_rows    WHERE note_id = v_note_id;
  DELETE FROM note_items     WHERE note_id = v_note_id;
  DELETE FROM history_rows   WHERE note_id = v_note_id;

  -- ③ overview_items 삽입
  IF jsonb_array_length(COALESCE(p_overview, '[]'::JSONB)) > 0 THEN
    INSERT INTO overview_items (note_id, sort_order, text)
    SELECT
      v_note_id,
      (ordinality - 1)::INTEGER,
      COALESCE(item->>'text', '')
    FROM jsonb_array_elements(p_overview) WITH ORDINALITY AS t(item, ordinality);
  END IF;

  -- ④ XEA detail_rows 삽입
  IF jsonb_array_length(COALESCE(p_xea_details, '[]'::JSONB)) > 0 THEN
    INSERT INTO detail_rows (note_id, type, ref, category, title, "desc", sort_order)
    SELECT
      v_note_id, 'xea',
      COALESCE(item->>'ref',      ''),
      COALESCE(item->>'category', ''),
      COALESCE(item->>'title',    ''),
      COALESCE(item->>'desc',     ''),
      (ordinality - 1)::INTEGER
    FROM jsonb_array_elements(p_xea_details) WITH ORDINALITY AS t(item, ordinality);
  END IF;

  -- ⑤ XES detail_rows 삽입
  IF jsonb_array_length(COALESCE(p_xes_details, '[]'::JSONB)) > 0 THEN
    INSERT INTO detail_rows (note_id, type, ref, category, title, "desc", sort_order)
    SELECT
      v_note_id, 'xes',
      COALESCE(item->>'ref',      ''),
      COALESCE(item->>'category', ''),
      COALESCE(item->>'title',    ''),
      COALESCE(item->>'desc',     ''),
      (ordinality - 1)::INTEGER
    FROM jsonb_array_elements(p_xes_details) WITH ORDINALITY AS t(item, ordinality);
  END IF;

  -- ⑥ Test Version detail_rows 삽입
  IF jsonb_array_length(COALESCE(p_test_versions, '[]'::JSONB)) > 0 THEN
    INSERT INTO detail_rows (note_id, type, ref, category, title, "desc", sort_order)
    SELECT
      v_note_id, 'test',
      COALESCE(item->>'ref',      ''),
      COALESCE(item->>'category', ''),
      COALESCE(item->>'title',    ''),
      COALESCE(item->>'desc',     ''),
      (ordinality - 1)::INTEGER
    FROM jsonb_array_elements(p_test_versions) WITH ORDINALITY AS t(item, ordinality);
  END IF;

  -- ⑦ note_items 삽입
  IF jsonb_array_length(COALESCE(p_note_items, '[]'::JSONB)) > 0 THEN
    INSERT INTO note_items (note_id, icon, text, sort_order)
    SELECT
      v_note_id,
      COALESCE(item->>'icon', '!'),
      COALESCE(item->>'text', ''),
      (ordinality - 1)::INTEGER
    FROM jsonb_array_elements(p_note_items) WITH ORDINALITY AS t(item, ordinality);
  END IF;

  -- ⑧ history_rows 삽입
  IF jsonb_array_length(COALESCE(p_history, '[]'::JSONB)) > 0 THEN
    INSERT INTO history_rows (note_id, date, xea, xes, cim, summary, sort_order)
    SELECT
      v_note_id,
      COALESCE(item->>'date',    ''),
      COALESCE(item->>'xea',     ''),
      COALESCE(item->>'xes',     ''),
      COALESCE(item->>'cim',     ''),
      COALESCE(item->>'summary', ''),
      (ordinality - 1)::INTEGER
    FROM jsonb_array_elements(p_history) WITH ORDINALITY AS t(item, ordinality);
  END IF;

  RETURN v_note_id;
END;
$$;

-- ============================================================
-- Row Level Security — Phase 1: 비활성화
-- API 서버가 Service Role Key로 RLS 우회하여 직접 접근
-- ============================================================
ALTER TABLE notes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE overview_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE detail_rows    DISABLE ROW LEVEL SECURITY;
ALTER TABLE note_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE history_rows   DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_locks     DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- [Phase 2] RLS 활성화 + 정책 — 아래는 Phase 2에서 별도 실행
-- ============================================================
--
-- /* Step 1: RLS 활성화 */
-- ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE overview_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE detail_rows    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE note_items     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE history_rows   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE edit_locks     ENABLE ROW LEVEL SECURITY;
--
-- /* Step 2: notes 정책 */
-- CREATE POLICY "notes_select_public"
--   ON notes FOR SELECT
--   USING (true);
--
-- CREATE POLICY "notes_insert_auth"
--   ON notes FOR INSERT
--   WITH CHECK (auth.role() = 'authenticated');
--
-- CREATE POLICY "notes_update_auth"
--   ON notes FOR UPDATE
--   USING (auth.role() = 'authenticated');
--
-- CREATE POLICY "notes_delete_admin"
--   ON notes FOR DELETE
--   USING (
--     EXISTS (
--       SELECT 1 FROM user_roles
--       WHERE user_id = auth.uid() AND role = 'admin'
--     )
--   );
--
-- /* Step 3: 자식 테이블 정책 (overview_items / detail_rows / note_items / history_rows) */
-- CREATE POLICY "child_select_public"   ON overview_items FOR SELECT USING (true);
-- CREATE POLICY "child_write_auth"      ON overview_items FOR ALL   USING (auth.role() = 'authenticated');
--
-- CREATE POLICY "child_select_public"   ON detail_rows    FOR SELECT USING (true);
-- CREATE POLICY "child_write_auth"      ON detail_rows    FOR ALL   USING (auth.role() = 'authenticated');
--
-- CREATE POLICY "child_select_public"   ON note_items     FOR SELECT USING (true);
-- CREATE POLICY "child_write_auth"      ON note_items     FOR ALL   USING (auth.role() = 'authenticated');
--
-- CREATE POLICY "child_select_public"   ON history_rows   FOR SELECT USING (true);
-- CREATE POLICY "child_write_auth"      ON history_rows   FOR ALL   USING (auth.role() = 'authenticated');
--
-- /* Step 4: edit_locks 정책 */
-- CREATE POLICY "locks_select_public"
--   ON edit_locks FOR SELECT
--   USING (true);
--
-- CREATE POLICY "locks_write_auth"
--   ON edit_locks FOR ALL
--   USING (auth.role() = 'authenticated');
--
-- ============================================================
-- [Phase 2] Audit Log 테이블 — 선택적 추가
-- ============================================================
--
-- CREATE TABLE IF NOT EXISTS note_audit_logs (
--   id          UUID        NOT NULL DEFAULT gen_random_uuid(),
--   note_id     UUID        REFERENCES notes (id) ON DELETE SET NULL,
--   action      TEXT        NOT NULL,
--   actor_id    UUID,
--   actor_name  TEXT        NOT NULL DEFAULT '',
--   site        TEXT        NOT NULL DEFAULT '',
--   equipment   TEXT        NOT NULL DEFAULT '',
--   payload     JSONB,
--   created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
--
--   CONSTRAINT note_audit_logs_pkey PRIMARY KEY (id)
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_audit_note_id    ON note_audit_logs (note_id);
-- CREATE INDEX IF NOT EXISTS idx_audit_actor_id   ON note_audit_logs (actor_id);
-- CREATE INDEX IF NOT EXISTS idx_audit_created_at ON note_audit_logs (created_at DESC);
