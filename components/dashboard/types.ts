export type Item = {
  noteId?: string;
  file: string;
  site: string;
  equipment: string;
  date: string;
  xeaAfter: string;
  xesAfter: string;
  cimVer: string;
  hasOverview: boolean;
  hasHistory: boolean;
  overviewCount: number;
  historyCount: number;
  updatedAt: string;
  status: 'editable' | 'no_data' | 'locked' | 'stale_lock';
  lockUser?: string;
  lockUpdatedAt?: string;
  lockStale?: boolean;
};

export type SortKey = 'recent' | 'site' | 'equipment';

export type StatusFilter = 'all' | 'editable' | 'locked' | 'stale_lock' | 'no_data';

export type DisplayStatus = Item['status'];

export function resolveDisplayStatus(item: Item): DisplayStatus {
  if (item.status === 'locked' && item.lockStale) {
    return 'stale_lock';
  }
  return item.status;
}

export function matchesStatusFilter(item: Item, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  return resolveDisplayStatus(item) === filter;
}
