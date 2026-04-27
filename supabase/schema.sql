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

  CONSTRAINT note_items_pkey       PRIMARY KEY (id),
  CONSTRAINT note_items_note_fk    FOREIGN KEY (note_id)
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
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
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

CREATE INDEX IF NOT EXISTS idx_notes_updated_at
  ON notes (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_site_equipment
  ON notes (site, equipment);

CREATE INDEX IF NOT EXISTS idx_overview_items_note_id
  ON overview_items (note_id);
CREATE INDEX IF NOT EXISTS idx_overview_items_note_order
  ON overview_items (note_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_detail_rows_note_id
  ON detail_rows (note_id);
CREATE INDEX IF NOT EXISTS idx_detail_rows_note_type_order
  ON detail_rows (note_id, type, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_note_items_note_id
  ON note_items (note_id);
CREATE INDEX IF NOT EXISTS idx_note_items_note_order
  ON note_items (note_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_history_rows_note_id
  ON history_rows (note_id);
CREATE INDEX IF NOT EXISTS idx_history_rows_note_order
  ON history_rows (note_id, sort_order ASC);

CREATE INDEX IF NOT EXISTS idx_edit_locks_site_equipment
  ON edit_locks (site, equipment);
CREATE INDEX IF NOT EXISTS idx_edit_locks_expires_at
  ON edit_locks (expires_at ASC);

-- ============================================================
-- 저장 RPC
-- notes + child rows를 하나의 트랜잭션으로 교체 저장
-- ============================================================
CREATE OR REPLACE FUNCTION save_note(payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_site        TEXT := COALESCE(TRIM(payload->>'site'), '');
  v_equipment   TEXT := COALESCE(TRIM(payload->>'equipment'), '');
  v_note_id     UUID;
  v_updated_by  TEXT := COALESCE(TRIM(payload->>'updatedBy'), COALESCE(TRIM(payload->>'updated_by'), ''));
  item          JSONB;
  idx           INTEGER := 0;
BEGIN
  IF v_site = '' OR v_equipment = '' THEN
    RAISE EXCEPTION 'site and equipment are required';
  END IF;

  INSERT INTO notes (
    site, equipment, date,
    xea_before, xea_after,
    xes_before, xes_after,
    cim_ver, updated_by
  )
  VALUES (
    v_site,
    v_equipment,
    COALESCE(payload->>'date', ''),
    COALESCE(payload->>'xeaBefore', ''),
    COALESCE(payload->>'xeaAfter', ''),
    COALESCE(payload->>'xesBefore', ''),
    COALESCE(payload->>'xesAfter', ''),
    COALESCE(payload->>'cimVer', ''),
    v_updated_by
  )
  ON CONFLICT (site, equipment)
  DO UPDATE SET
    date = EXCLUDED.date,
    xea_before = EXCLUDED.xea_before,
    xea_after = EXCLUDED.xea_after,
    xes_before = EXCLUDED.xes_before,
    xes_after = EXCLUDED.xes_after,
    cim_ver = EXCLUDED.cim_ver,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
  RETURNING id INTO v_note_id;

  DELETE FROM overview_items WHERE note_id = v_note_id;
  DELETE FROM detail_rows WHERE note_id = v_note_id;
  DELETE FROM note_items WHERE note_id = v_note_id;
  DELETE FROM history_rows WHERE note_id = v_note_id;

  idx := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'overview', '[]'::jsonb))
  LOOP
    INSERT INTO overview_items (note_id, sort_order, text)
    VALUES (v_note_id, idx, COALESCE(item #>> '{}', ''));
    idx := idx + 1;
  END LOOP;

  idx := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'xeaDetails', '[]'::jsonb))
  LOOP
    INSERT INTO detail_rows (note_id, type, ref, category, title, "desc", sort_order)
    VALUES (
      v_note_id, 'xea',
      COALESCE(item->>'ref', ''),
      COALESCE(item->>'category', ''),
      COALESCE(item->>'title', ''),
      COALESCE(item->>'desc', ''),
      idx
    );
    idx := idx + 1;
  END LOOP;

  idx := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'xesDetails', '[]'::jsonb))
  LOOP
    INSERT INTO detail_rows (note_id, type, ref, category, title, "desc", sort_order)
    VALUES (
      v_note_id, 'xes',
      COALESCE(item->>'ref', ''),
      COALESCE(item->>'category', ''),
      COALESCE(item->>'title', ''),
      COALESCE(item->>'desc', ''),
      idx
    );
    idx := idx + 1;
  END LOOP;

  idx := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'testVersions', '[]'::jsonb))
  LOOP
    INSERT INTO detail_rows (note_id, type, ref, category, title, "desc", sort_order)
    VALUES (
      v_note_id, 'test',
      COALESCE(item->>'ref', COALESCE(item->>'label', '')),
      COALESCE(item->>'category', 'Test Version'),
      COALESCE(item->>'title', COALESCE(item->>'version', '')),
      COALESCE(item->>'desc', COALESCE(item->>'change', '')),
      idx
    );
    idx := idx + 1;
  END LOOP;

  idx := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'notes', '[]'::jsonb))
  LOOP
    INSERT INTO note_items (note_id, icon, text, sort_order)
    VALUES (
      v_note_id,
      CASE WHEN COALESCE(item->>'icon', '!') IN ('!', 'i') THEN COALESCE(item->>'icon', '!') ELSE '!' END,
      COALESCE(item->>'text', ''),
      idx
    );
    idx := idx + 1;
  END LOOP;

  idx := 0;
  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'history', '[]'::jsonb))
  LOOP
    INSERT INTO history_rows (note_id, date, xea, xes, cim, summary, sort_order)
    VALUES (
      v_note_id,
      COALESCE(item->>'date', ''),
      COALESCE(item->>'xea', ''),
      COALESCE(item->>'xes', ''),
      COALESCE(item->>'cim', ''),
      COALESCE(item->>'summary', ''),
      idx
    );
    idx := idx + 1;
  END LOOP;

  RETURN v_note_id;
END;
$$;

-- ============================================================
-- 락 RPC
-- ============================================================
CREATE OR REPLACE FUNCTION acquire_lock(
  p_site TEXT,
  p_equipment TEXT,
  p_user_name TEXT,
  p_duration_minutes INTEGER DEFAULT 600
)
RETURNS TABLE(
  acquired BOOLEAN,
  taken_over BOOLEAN,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  stale BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing edit_locks%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_new_expires TIMESTAMPTZ := v_now + make_interval(mins => p_duration_minutes);
BEGIN
  SELECT * INTO v_existing
  FROM edit_locks
  WHERE site = p_site AND equipment = p_equipment
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO edit_locks (site, equipment, user_name, locked_at, expires_at)
    VALUES (p_site, p_equipment, p_user_name, v_now, v_new_expires);

    RETURN QUERY SELECT true, false, p_user_name, v_now, v_new_expires, false;
    RETURN;
  END IF;

  IF v_existing.user_name = p_user_name OR v_existing.expires_at < v_now THEN
    UPDATE edit_locks
    SET user_name = p_user_name,
        locked_at = CASE WHEN v_existing.user_name = p_user_name THEN v_existing.locked_at ELSE v_now END,
        expires_at = v_new_expires,
        updated_at = v_now
    WHERE id = v_existing.id;

    RETURN QUERY SELECT true, (v_existing.user_name <> p_user_name), p_user_name,
                        CASE WHEN v_existing.user_name = p_user_name THEN v_existing.locked_at ELSE v_now END,
                        v_new_expires,
                        false;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, false, v_existing.user_name, v_existing.locked_at, v_existing.expires_at, false;
END;
$$;

CREATE OR REPLACE FUNCTION release_lock(
  p_site TEXT,
  p_equipment TEXT,
  p_user_name TEXT
)
RETURNS TABLE(
  released BOOLEAN,
  locked_by TEXT,
  stale BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing edit_locks%ROWTYPE;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_existing
  FROM edit_locks
  WHERE site = p_site AND equipment = p_equipment
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT true, ''::TEXT, false;
    RETURN;
  END IF;

  IF v_existing.user_name = p_user_name OR v_existing.expires_at < v_now THEN
    DELETE FROM edit_locks WHERE id = v_existing.id;
    RETURN QUERY SELECT true, v_existing.user_name, (v_existing.expires_at < v_now);
    RETURN;
  END IF;

  RETURN QUERY SELECT false, v_existing.user_name, false;
END;
$$;

-- ============================================================
-- Row Level Security — Phase 1: 비활성화
-- ============================================================
ALTER TABLE notes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE overview_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE detail_rows    DISABLE ROW LEVEL SECURITY;
ALTER TABLE note_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE history_rows   DISABLE ROW LEVEL SECURITY;
ALTER TABLE edit_locks     DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- [Phase 2] RLS 활성화 + 정책 — Phase 2에서 별도 실행
-- ============================================================
--
-- ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE overview_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE detail_rows    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE note_items     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE history_rows   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE edit_locks     ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "notes_select_public" ON notes FOR SELECT USING (true);
-- CREATE POLICY "notes_insert_auth"   ON notes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "notes_update_auth"   ON notes FOR UPDATE USING (auth.role() = 'authenticated');
--
-- CREATE POLICY "overview_select_public" ON overview_items FOR SELECT USING (true);
-- CREATE POLICY "overview_write_auth"    ON overview_items FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "detail_select_public"   ON detail_rows FOR SELECT USING (true);
-- CREATE POLICY "detail_write_auth"      ON detail_rows FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "note_items_select_public" ON note_items FOR SELECT USING (true);
-- CREATE POLICY "note_items_write_auth"    ON note_items FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "history_select_public"  ON history_rows FOR SELECT USING (true);
-- CREATE POLICY "history_write_auth"     ON history_rows FOR ALL USING (auth.role() = 'authenticated');
-- CREATE POLICY "locks_select_public"    ON edit_locks FOR SELECT USING (true);
-- CREATE POLICY "locks_write_auth"       ON edit_locks FOR ALL USING (auth.role() = 'authenticated');


-- ============================================================
-- 7. dashboard_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_settings (
  key         TEXT        NOT NULL,
  value       TEXT        NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT dashboard_settings_pkey PRIMARY KEY (key)
);

CREATE OR REPLACE TRIGGER trg_dashboard_settings_updated_at
  BEFORE UPDATE ON dashboard_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO dashboard_settings (key, value)
VALUES (
  'dashboard_password_hash',
  '5335c1c78b99ea77b73cc03f735adc472835dc47c10e553d20f6e7ba338c0da3'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 정규화 기준 중복 방지 보강
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS notes_site_equipment_normalized_key
  ON notes (
    UPPER(REGEXP_REPLACE(TRIM(site), '\s+', '_', 'g')),
    UPPER(REGEXP_REPLACE(TRIM(equipment), '\s+', '', 'g'))
  );

CREATE UNIQUE INDEX IF NOT EXISTS edit_locks_site_equipment_normalized_key
  ON edit_locks (
    UPPER(REGEXP_REPLACE(TRIM(site), '\s+', '_', 'g')),
    UPPER(REGEXP_REPLACE(TRIM(equipment), '\s+', '', 'g'))
  );
