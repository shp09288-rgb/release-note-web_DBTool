import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toSaveErrorBody } from '@/lib/note-save';
import {
  matchesNormalizedNoteKey,
  normalizeEquipment,
  normalizeSite,
  pickExistingNoteByNormalizedKey,
  siteLookupCandidates,
} from '@/lib/note-utils';

describe('normalizeSite / normalizeEquipment', () => {
  it('matches DB functional unique index expressions', () => {
    assert.equal(normalizeSite('fab a'), 'FAB_A');
    assert.equal(normalizeSite('FAB  A'), 'FAB_A');
    assert.equal(normalizeEquipment('eq 001'), 'EQ001');
    assert.equal(normalizeEquipment('EQ001'), 'EQ001');
  });
});

describe('matchesNormalizedNoteKey', () => {
  it('treats different raw site strings as the same normalized key', () => {
    const normalizedSite = normalizeSite('FAB_A');
    const normalizedEquipment = normalizeEquipment('EQ001');

    assert.equal(
      matchesNormalizedNoteKey(
        { site: 'FAB A', equipment: 'EQ001' },
        normalizedSite,
        normalizedEquipment
      ),
      true
    );
    assert.equal(
      matchesNormalizedNoteKey(
        { site: 'FAB_A', equipment: 'EQ001' },
        normalizedSite,
        normalizedEquipment
      ),
      true
    );
    assert.equal(
      matchesNormalizedNoteKey(
        { site: 'OTHER', equipment: 'EQ001' },
        normalizedSite,
        normalizedEquipment
      ),
      false
    );
  });
});

describe('pickExistingNoteByNormalizedKey', () => {
  it('picks the most recently updated row when duplicates exist', () => {
    const picked = pickExistingNoteByNormalizedKey(
      [
        {
          id: 'old',
          site: 'FAB A',
          equipment: 'EQ001',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'new',
          site: 'FAB_A',
          equipment: 'EQ001',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ],
      normalizeSite('FAB_A'),
      normalizeEquipment('EQ001')
    );

    assert.equal(picked?.id, 'new');
  });

  it('returns null when no normalized match exists (new note path)', () => {
    const picked = pickExistingNoteByNormalizedKey(
      [{ id: '1', site: 'SITE_A', equipment: 'EQ001', updated_at: '2025-01-01T00:00:00Z' }],
      normalizeSite('SITE_B'),
      normalizeEquipment('EQ002')
    );

    assert.equal(picked, null);
  });
});

describe('siteLookupCandidates', () => {
  it('includes underscore and space variants for legacy rows', () => {
    const candidates = siteLookupCandidates('FAB_A');
    assert.ok(candidates.includes('FAB_A'));
    assert.ok(candidates.includes('FAB A'));
  });
});

describe('save flow decision', () => {
  it('uses UPDATE path when raw values differ but normalized key matches', () => {
    const rows = [
      {
        id: 'note-1',
        site: 'FAB A',
        equipment: 'EQ001',
        updated_at: '2025-06-01T00:00:00Z',
      },
    ];

    const requestSite = normalizeSite('FAB_A');
    const requestEquipment = normalizeEquipment('EQ001');
    const existing = pickExistingNoteByNormalizedKey(rows, requestSite, requestEquipment);

    assert.ok(existing);
    assert.equal(existing.id, 'note-1');
    assert.notEqual(existing.site, requestSite);
    assert.equal(normalizeSite(existing.site), requestSite);
  });

  it('uses INSERT path when no normalized match exists', () => {
    const existing = pickExistingNoteByNormalizedKey(
      [],
      normalizeSite('NEW_SITE'),
      normalizeEquipment('NEW_EQ')
    );

    assert.equal(existing, null);
  });
});

describe('toSaveErrorBody', () => {
  it('includes stage, message, code, and details for postgres errors', () => {
    const body = toSaveErrorBody('notes-insert', {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      details: 'notes_site_equipment_normalized_key',
    });

    assert.equal(body.ok, false);
    assert.equal(body.stage, 'notes-insert');
    assert.equal(body.code, '23505');
    assert.match(body.message, /duplicate key/i);
    assert.equal(body.details, 'notes_site_equipment_normalized_key');
  });
});
