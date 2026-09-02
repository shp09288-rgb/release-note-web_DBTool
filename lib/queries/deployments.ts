import { createServerClient } from '@/lib/supabase';
import type {
  DeploymentRow,
  DeploymentItemRow,
  DeploymentWithItems,
  DeploymentDraft,
  EquipmentSummary,
  SearchHit,
} from '@/lib/queries/types';

const DEPLOYMENT_COLUMNS =
  'id, site, equipment, model, deployed_on, ' +
  'xea_from_raw, xea_from_build, xea_to_raw, xea_to_build, ' +
  'xes_from_raw, xes_from_build, xes_to_raw, xes_to_build, ' +
  'cim_ver, author, source_kind, source_file, body_text, edited_at, updated_at';

export async function listEquipment(): Promise<EquipmentSummary[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('deployments')
    .select(`${DEPLOYMENT_COLUMNS}, deployment_items(flags)`)
    .order('deployed_on', { ascending: false });

  if (error) throw new Error(error.message);

  const byKey = new Map<string, EquipmentSummary>();

  for (const row of (data ?? []) as any[]) {
    const key = `${row.site}::${row.equipment}`;
    const notApplied = (row.deployment_items ?? []).filter((i: any) =>
      (i.flags ?? []).includes('not_applied')
    ).length;

    const existing = byKey.get(key);
    if (!existing) {
      // 정렬이 최신순이므로 처음 만나는 행이 최신 배포다.
      byKey.set(key, {
        site: row.site,
        equipment: row.equipment,
        model: row.model,
        latestDeployedOn: row.deployed_on,
        xeaToRaw: row.xea_to_raw,
        xesToRaw: row.xes_to_raw,
        deploymentCount: 1,
        notAppliedCount: notApplied,
      });
    } else {
      existing.deploymentCount += 1;
      existing.notAppliedCount += notApplied;
    }
  }

  return [...byKey.values()].sort((a, b) => a.site.localeCompare(b.site));
}

export async function getTimeline(
  site: string,
  equipment: string
): Promise<DeploymentWithItems[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('deployments')
    .select(`${DEPLOYMENT_COLUMNS}, deployment_items(*)`)
    .eq('site', site)
    .eq('equipment', equipment)
    .order('deployed_on', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as any[]).map((row) => ({
    ...(row as DeploymentRow),
    items: ((row.deployment_items ?? []) as DeploymentItemRow[]).sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  }));
}

export async function getDeployment(id: string): Promise<DeploymentWithItems | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('deployments')
    .select(`${DEPLOYMENT_COLUMNS}, raw_html, deployment_items(*)`)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as any;
  return {
    ...(row as DeploymentRow),
    raw_html: row.raw_html ?? null,
    items: ((row.deployment_items ?? []) as DeploymentItemRow[]).sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  };
}

/**
 * PMS 번호 또는 키워드로 항목을 찾는다.
 *
 * ILIKE 로 간다. 배포 100건 규모에서 tsvector 는 한국어 토크나이저가 약해
 * 이득이 없다. 느려지면 그때 pg_trgm 을 단다.
 */
export async function searchItems(query: string): Promise<SearchHit[]> {
  const supabase = createServerClient();
  const term = String(query ?? '').trim();
  if (!term) return [];

  const asNumber = /^\d{3,5}$/.test(term) ? Number(term) : null;
  const hits: SearchHit[] = [];

  // 1) 항목 단위 (html_upload 출처)
  let itemQuery = supabase
    .from('deployment_items')
    .select(`*, deployments!inner(${DEPLOYMENT_COLUMNS})`)
    .limit(200);

  itemQuery = asNumber
    ? itemQuery.eq('pms_no', asNumber)
    : itemQuery.or(
        `title.ilike.%${term}%,phenomenon.ilike.%${term}%,body_text.ilike.%${term}%`
      );

  const { data: itemRows, error: itemError } = await itemQuery;
  if (itemError) throw new Error(itemError.message);

  for (const row of (itemRows ?? []) as any[]) {
    const dep = row.deployments;
    hits.push({
      itemId: row.id,
      deploymentId: dep.id,
      site: dep.site,
      equipment: dep.equipment,
      deployedOn: dep.deployed_on,
      xeaToRaw: dep.xea_to_raw,
      xesToRaw: dep.xes_to_raw,
      sourceKind: dep.source_kind,
      pmsNo: row.pms_no,
      section: row.section,
      title: row.title,
      snippet: String(row.phenomenon || row.body_text || '').slice(0, 200),
      notApplied: (row.flags ?? []).includes('not_applied'),
    });
  }

  // 2) 레거시 배포 — 항목이 없으므로 배포 단위로 잡는다
  let depQuery = supabase.from('deployments').select(DEPLOYMENT_COLUMNS).limit(200);

  if (asNumber) {
    const { data: refs } = await supabase
      .from('deployment_pms_refs')
      .select('deployment_id')
      .eq('pms_no', asNumber);
    const ids = (refs ?? []).map((r: any) => r.deployment_id);
    if (!ids.length) return hits;
    depQuery = depQuery.in('id', ids);
  } else {
    depQuery = depQuery.ilike('body_text', `%${term}%`);
  }

  const { data: depRows, error: depError } = await depQuery;
  if (depError) throw new Error(depError.message);

  const seen = new Set(hits.map((h) => h.deploymentId));

  for (const dep of (depRows ?? []) as any[]) {
    if (seen.has(dep.id)) continue;
    hits.push({
      itemId: null,
      deploymentId: dep.id,
      site: dep.site,
      equipment: dep.equipment,
      deployedOn: dep.deployed_on,
      xeaToRaw: dep.xea_to_raw,
      xesToRaw: dep.xes_to_raw,
      sourceKind: dep.source_kind,
      pmsNo: asNumber,
      section: '',
      title: '(항목 미분해 — 배포 요약에서 발견)',
      snippet: String(dep.body_text ?? '').slice(0, 200),
      notApplied: false,
    });
  }

  return hits.sort((a, b) => String(b.deployedOn).localeCompare(String(a.deployedOn)));
}

/**
 * 배포 1건과 딸린 행들을 저장하고 id 를 돌려준다.
 *
 * 같은 배포가 이미 있으면 그 id 를 재사용하고 자식 행을 갈아끼운다.
 * 이관 스크립트를 여러 번 돌려도 결과가 같아야 한다.
 *
 * upsert 의 on_conflict 를 쓰지 않고 직접 찾아서 갱신한다. PostgREST 의
 * on_conflict 는 컬럼 목록만 받아 인덱스 이름을 지정할 수 없고, NULL 이 섞인
 * 식별자에서 동작이 미묘하다. 90건 규모라 조회 한 번이 비싸지 않다.
 */
export async function insertDeployment(draft: DeploymentDraft): Promise<string> {
  const supabase = createServerClient();

  const bodyText =
    draft.bodyText ??
    draft.items
      .map((i) => [i.title, i.phenomenon, ...i.improvements.flatMap((g) => g.lines)].join('\n'))
      .join('\n');

  const payload = {
    site: draft.site,
    equipment: draft.equipment,
    model: draft.model,
    deployed_on: draft.deployedOn,
    xea_from_raw: draft.xeaFromRaw, xea_from_build: draft.xeaFromBuild,
    xea_to_raw: draft.xeaToRaw,     xea_to_build: draft.xeaToBuild,
    xes_from_raw: draft.xesFromRaw, xes_from_build: draft.xesFromBuild,
    xes_to_raw: draft.xesToRaw,     xes_to_build: draft.xesToBuild,
    cim_ver: draft.cimVer,
    author: draft.author,
    source_kind: draft.sourceKind,
    source_file: draft.sourceFile,
    raw_html: draft.rawHtml,
    body_text: bodyText,
    edited_at: draft.edited ? new Date().toISOString() : null,
  };

  // 식별자로 기존 배포를 찾는다. NULL 은 .is() 로 비교해야 한다 — .eq(null) 은 안 맞는다.
  let finder = supabase
    .from('deployments')
    .select('id')
    .eq('site', draft.site)
    .eq('equipment', draft.equipment);

  finder = draft.deployedOn
    ? finder.eq('deployed_on', draft.deployedOn)
    : finder.is('deployed_on', null);
  finder = draft.xeaToBuild != null
    ? finder.eq('xea_to_build', draft.xeaToBuild)
    : finder.is('xea_to_build', null);
  finder = draft.xesToBuild != null
    ? finder.eq('xes_to_build', draft.xesToBuild)
    : finder.is('xes_to_build', null);

  const { data: existing, error: findError } = await finder.limit(1).maybeSingle();
  if (findError) throw new Error(findError.message);

  let deploymentId: string;

  if (existing) {
    deploymentId = (existing as any).id as string;
    const { error } = await supabase.from('deployments').update(payload).eq('id', deploymentId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('deployments')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    deploymentId = (data as any).id as string;
  }

  // 자식 행은 통째로 갈아끼운다.
  await supabase.from('deployment_items').delete().eq('deployment_id', deploymentId);
  await supabase.from('deployment_alarms').delete().eq('deployment_id', deploymentId);
  await supabase.from('deployment_pms_refs').delete().eq('deployment_id', deploymentId);

  if (draft.items.length) {
    const { error: itemError } = await supabase.from('deployment_items').insert(
      draft.items.map((i) => ({
        deployment_id: deploymentId,
        pms_no: i.pmsNo,
        anchor_id: i.anchorId,
        section: i.section,
        section_no: i.sectionNo,
        title: i.title,
        phenomenon: i.phenomenon,
        improvements: i.improvements,
        flags: i.flags,
        body_text: [i.title, i.phenomenon, ...i.improvements.flatMap((g) => g.lines)].join('\n'),
        sort_order: i.sortOrder,
      }))
    );
    if (itemError) throw new Error(itemError.message);
  }

  if (draft.alarms.length) {
    await supabase.from('deployment_alarms').insert(
      draft.alarms.map((a) => ({
        deployment_id: deploymentId,
        alarm_id: a.alarmId,
        text: a.text,
        pms_no: a.pmsNo,
      }))
    );
  }

  // PMS 링크 — 항목/알람/레거시 텍스트를 한데 모아 중복 제거
  const refs = new Map<number, string>();
  for (const i of draft.items) {
    if (i.pmsNo != null) refs.set(i.pmsNo, 'item');
    for (const extra of i.pmsExtra) refs.set(extra, 'item');
  }
  for (const a of draft.alarms) {
    if (a.pmsNo != null && !refs.has(a.pmsNo)) refs.set(a.pmsNo, 'alarm');
  }
  for (const n of draft.legacyPmsRefs ?? []) {
    if (!refs.has(n)) refs.set(n, 'legacy_text');
  }

  if (refs.size) {
    await supabase.from('deployment_pms_refs').insert(
      [...refs.entries()].map(([pms_no, source]) => ({
        deployment_id: deploymentId,
        pms_no,
        source,
      }))
    );
  }

  return deploymentId;
}
