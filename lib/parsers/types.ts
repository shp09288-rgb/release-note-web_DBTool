export type ParseWarning = { field: string; message: string };

export type ParsedImprovement = {
  component: 'xea' | 'xes';
  lines: string[];
};

export type ParsedItem = {
  pmsNo: number | null;
  pmsExtra: number[];
  anchorId: string;
  section: string;
  sectionNo: number;
  title: string;
  phenomenon: string;
  improvements: ParsedImprovement[];
  flags: string[];
  bodyText: string;
  sortOrder: number;
};

export type ParsedAlarm = {
  alarmId: string;
  text: string;
  pmsNo: number | null;
};

export type ParsedHeader = {
  site: string | null;
  /** 문서에 설비 번호가 없다. 항상 null — 사람이 미리보기에서 고른다. */
  equipment: string | null;
  model: string | null;
  author: string | null;
  xeaFromRaw: string;
  xeaFromBuild: number | null;
  xeaToRaw: string;
  xeaToBuild: number | null;
  xesFromRaw: string;
  xesFromBuild: number | null;
  xesToRaw: string;
  xesToBuild: number | null;
};

export type ParsedDocument = {
  header: ParsedHeader;
  /** chip 클래스 -> 문서가 스스로 정의한 라벨. 예: { a5: 'SDC A5 요청 또는 발생 건' } */
  legend: Record<string, string>;
  items: ParsedItem[];
  alarms: ParsedAlarm[];
  warnings: ParseWarning[];
};
