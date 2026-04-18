export function normalizeSite(value: string) {
  return String(value || '').trim().replace(/\s+/g, '_').toUpperCase();
}

export function normalizeEquipment(value: string) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

export function buildSyntheticFileName(site: string, equipment: string) {
  return `${normalizeSite(site)}_${normalizeEquipment(equipment)}.json`;
}
