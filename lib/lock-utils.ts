import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import path from 'path';

export type LockInfo = {
  site: string;
  equipment: string;
  user: string;
  createdAt: string;
  updatedAt: string;
};

export const LOCK_STALE_MS = 1000 * 60 * 60 * 10; // 10분

function safeName(value: string) {
  return String(value || '').replace(/[^\w\-]/g, '_');
}

export function getLockDir() {
  return path.join(process.cwd(), 'data', '_locks');
}

export function getLockFilePath(site: string, equipment: string) {
  const siteKey = safeName(site);
  const eqKey = safeName(equipment);
  return path.join(getLockDir(), `${siteKey}__${eqKey}.lock.json`);
}

export async function ensureLockDir() {
  await mkdir(getLockDir(), { recursive: true });
}

export async function readLock(site: string, equipment: string): Promise<LockInfo | null> {
  try {
    const filePath = getLockFilePath(site, equipment);
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as LockInfo;
  } catch {
    return null;
  }
}

export async function getLockMeta(site: string, equipment: string) {
  const filePath = getLockFilePath(site, equipment);

  try {
    const lock = await readLock(site, equipment);
    if (!lock) return null;

    const fileStat = await stat(filePath);
    const age = Date.now() - fileStat.mtime.getTime();
    const stale = age > LOCK_STALE_MS;

    return {
      ...lock,
      stale,
      mtime: fileStat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function writeLock(site: string, equipment: string, user: string) {
  await ensureLockDir();

  const now = new Date().toISOString();
  const existing = await readLock(site, equipment);

  const payload: LockInfo = {
    site,
    equipment,
    user,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const filePath = getLockFilePath(site, equipment);
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');

  return payload;
}

export async function removeLock(site: string, equipment: string) {
  try {
    const filePath = getLockFilePath(site, equipment);
    await rm(filePath, { force: true });
  } catch {
    // ignore
  }
}