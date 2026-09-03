export type ParseWarning = { field: string; message: string };

/**
 * 'verify' 는 신 양식(Update Report)의 .ver 블록이다 — 판단·확인 방법·체크리스트.
 * 개선 내용은 아니지만 같은 항목에 속하므로 여기에 함께 담아 본문 검색에 걸리게 한다.
 */
export type ParsedImprovement = {
  component: 'xea' | 'xes' | 'verify';
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
