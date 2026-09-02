import type { ParsedImprovement } from '@/lib/parsers/types';

export type DeploymentRow = {
  id: string;
  site: string;
  equipment: string;
  model: string;
  deployed_on: string | null;
  xea_from_raw: string;
  xea_from_build: number | null;
  xea_to_raw: string;
  xea_to_build: number | null;
  xes_from_raw: string;
  xes_from_build: number | null;
  xes_to_raw: string;
  xes_to_build: number | null;
  cim_ver: string;
  author: string;
  source_kind: 'html_upload' | 'legacy_json';
  source_file: string;
  body_text: string;
  edited_at: string | null;
  updated_at: string;
};

export type DeploymentItemRow = {
  id: string;
  deployment_id: string;
  pms_no: number | null;
  anchor_id: string;
  section: string;
  section_no: number;
  title: string;
  phenomenon: string;
  improvements: ParsedImprovement[];
  flags: string[];
  body_text: string;
  sort_order: number;
};

export type DeploymentWithItems = DeploymentRow & {
  items: DeploymentItemRow[];
  raw_html?: string | null;
};

export type EquipmentSummary = {
  site: string;
  equipment: string;
  model: string;
  latestDeployedOn: string | null;
  xeaToRaw: string;
  xesToRaw: string;
  deploymentCount: number;
  notAppliedCount: number;
};

export type SearchHit = {
  itemId: string | null;
  deploymentId: string;
  site: string;
  equipment: string;
  deployedOn: string | null;
  xeaToRaw: string;
  xesToRaw: string;
  sourceKind: 'html_upload' | 'legacy_json';
  pmsNo: number | null;
  section: string;
  title: string;
  snippet: string;
  notApplied: boolean;
};

export type DeploymentDraft = {
  site: string;
  equipment: string;
  model: string;
  deployedOn: string | null;
  xeaFromRaw: string; xeaFromBuild: number | null;
  xeaToRaw: string;   xeaToBuild: number | null;
  xesFromRaw: string; xesFromBuild: number | null;
  xesToRaw: string;   xesToBuild: number | null;
  cimVer: string;
  author: string;
  sourceKind: 'html_upload' | 'legacy_json';
  sourceFile: string;
  rawHtml: string | null;
  edited: boolean;
  /**
   * 전문 검색용 본문. 비워 두면 items 에서 만든다.
   * 레거시는 items 가 없으므로 요약을 여기에 직접 넣는다.
   */
  bodyText?: string;
  items: Array<{
    pmsNo: number | null;
    pmsExtra: number[];
    anchorId: string;
    section: string;
    sectionNo: number;
    title: string;
    phenomenon: string;
    improvements: ParsedImprovement[];
    flags: string[];
    sortOrder: number;
  }>;
  alarms: Array<{ alarmId: string; text: string; pmsNo: number | null }>;
  /** 레거시 전용. 요약 텍스트에서 뽑은 PMS 번호 */
  legacyPmsRefs?: number[];
};
