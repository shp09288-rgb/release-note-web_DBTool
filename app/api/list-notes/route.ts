import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';
import { getLockMeta } from '@/lib/lock-utils';

type ReleaseNoteData = {
  site?: string;
  equipment?: string;
  date?: string;
  xeaAfter?: string;
  xesAfter?: string;
  cimVer?: string;
  overview?: unknown;
  history?: unknown;
};

function parseSiteAndEquipment(fileName: string) {
  const name = fileName.replace('.json', '');
  const parts = name.split('_');
  const equipment = parts.pop() || '';
  const site = parts.join('_');
  return { site, equipment };
}

function safeArrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const files = await readdir(dataDir);

    const jsonFiles = files.filter((file) => file.endsWith('.json'));

    const items = await Promise.all(
      jsonFiles.map(async (file) => {
        const filePath = path.join(dataDir, file);

        const { site: fallbackSite, equipment: fallbackEquipment } =
          parseSiteAndEquipment(file);

        let parsed: ReleaseNoteData = {};
        let fileStat: Awaited<ReturnType<typeof stat>> | null = null;

        try {
          const [raw, statResult] = await Promise.all([
            readFile(filePath, 'utf-8'),
            stat(filePath),
          ]);

          parsed = JSON.parse(raw) as ReleaseNoteData;
          fileStat = statResult;
        } catch (readErr) {
          console.error(`[list-notes] failed to read ${file}`, readErr);
        }

        const site = normalizeText(parsed.site) || fallbackSite;
        const equipment = normalizeText(parsed.equipment) || fallbackEquipment;

        const overviewCount = safeArrayLength(parsed.overview);
        const historyCount = safeArrayLength(parsed.history);

        const hasOverview = overviewCount > 0;
        const hasHistory = historyCount > 0;

        const hasData =
          hasOverview ||
          hasHistory ||
          !!normalizeText(parsed.date) ||
          !!normalizeText(parsed.xeaAfter) ||
          !!normalizeText(parsed.xesAfter) ||
          !!normalizeText(parsed.cimVer);

        const lock = await getLockMeta(site, equipment);

        const status = lock
          ? lock.stale
            ? 'stale_lock'
            : 'locked'
          : hasData
          ? 'editable'
          : 'no_data';

        return {
          file,
          site,
          equipment,
          date: normalizeText(parsed.date),
          xeaAfter: normalizeText(parsed.xeaAfter),
          xesAfter: normalizeText(parsed.xesAfter),
          cimVer: normalizeText(parsed.cimVer),
          hasOverview,
          hasHistory,
          overviewCount,
          historyCount,
          updatedAt: fileStat?.mtime?.toISOString?.() || '',
          status,
          lockUser: lock?.user || '',
          lockUpdatedAt: lock?.updatedAt || '',
          lockStale: !!lock?.stale,
        };
      })
    );

    items.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

    return Response.json({
      ok: true,
      items,
    });
  } catch (err) {
    console.error(err);

    return Response.json({
      ok: false,
      items: [],
    });
  }
}