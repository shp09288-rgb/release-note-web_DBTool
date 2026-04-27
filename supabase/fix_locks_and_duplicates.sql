-- ============================================================
-- Release Note Web hotfix
-- 1) edit lock stale 기준: 10분
-- 2) 만료된 lock 삭제
-- 3) 중복 Site/Equipment note 정리 후 정규화 unique index 추가
-- ============================================================

-- 신규 lock 기본 만료 시간을 10분으로 변경
ALTER TABLE edit_locks
  ALTER COLUMN expires_at SET DEFAULT (now() + INTERVAL '10 minutes');

-- 이미 만료된 lock 즉시 제거
DELETE FROM edit_locks
WHERE expires_at <= now();

-- 중복 note 정리
-- 동일 Site/Equipment 정규화 키 기준으로 최신/데이터 많은 row 1개만 유지
WITH child_counts AS (
  SELECT note_id, COUNT(*) AS child_count
  FROM (
    SELECT note_id FROM overview_items
    UNION ALL SELECT note_id FROM detail_rows
    UNION ALL SELECT note_id FROM note_items
    UNION ALL SELECT note_id FROM history_rows
  ) c
  GROUP BY note_id
), ranked_notes AS (
  SELECT
    n.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        UPPER(REGEXP_REPLACE(TRIM(n.site), '\s+', '_', 'g')),
        UPPER(REGEXP_REPLACE(TRIM(n.equipment), '\s+', '', 'g'))
      ORDER BY
        COALESCE(cc.child_count, 0) DESC,
        n.updated_at DESC,
        n.created_at DESC
    ) AS rn
  FROM notes n
  LEFT JOIN child_counts cc ON cc.note_id = n.id
)
DELETE FROM notes n
USING ranked_notes r
WHERE n.id = r.id
  AND r.rn > 1;

-- 정규화 기준 중복 생성을 DB 레벨에서 차단
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
