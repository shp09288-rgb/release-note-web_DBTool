export function normalizeSite(value: string) {
  return String(value || '').trim().replace(/\s+/g, '_').toUpperCase();
}

export function normalizeEquipment(value: string) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

export function buildSyntheticFileName(site: string, equipment: string) {
  return `${normalizeSite(site)}_${normalizeEquipment(equipment)}.json`;
}

/** DB 조회용 site 후보 — 원문 표기 차이를 포괄 */
export function siteLookupCandidates(normalizedSite: string): string[] {
  const base = normalizedSite;
  return Array.from(
    new Set(
      [
        base,
        base.replace(/_/g, ' '),
        base.replace(/\s+/g, '_'),
        base.replace(/_/g, ' ').toLowerCase(),
        base.toLowerCase(),
      ].filter(Boolean)
    )
  );
}

export function matchesNormalizedNoteKey(
  row: { site: string; equipment: string },
  normalizedSite: string,
  normalizedEquipment: string
): boolean {
  return (
    normalizeSite(row.site) === normalizedSite &&
    normalizeEquipment(row.equipment) === normalizedEquipment
  );
}

export function pickExistingNoteByNormalizedKey<
  T extends { site: string; equipment: string; updated_at?: string | null },
>(rows: T[], normalizedSite: string, normalizedEquipment: string): T | null {
  const matches = rows.filter((row) =>
    matchesNormalizedNoteKey(row, normalizedSite, normalizedEquipment)
  );
  if (matches.length === 0) return null;

  return matches.sort((a, b) => {
    const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return bTime - aTime;
  })[0];
}
