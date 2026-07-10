export type SaveStage =
  | 'validate'
  | 'notes-select'
  | 'notes-update'
  | 'notes-insert'
  | 'child-delete'
  | 'overview-insert'
  | 'detail-insert'
  | 'note-items-insert'
  | 'history-insert'
  | 'unknown';

export type SaveErrorBody = {
  ok: false;
  stage: SaveStage;
  message: string;
  code?: string;
  details?: unknown;
};

type PostgresLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function toSaveErrorBody(stage: SaveStage, err: unknown): SaveErrorBody {
  if (err && typeof err === 'object') {
    const pg = err as PostgresLikeError;
    return {
      ok: false,
      stage,
      message: pg.message || (err instanceof Error ? err.message : '저장 실패'),
      code: pg.code,
      details: pg.details ?? pg.hint ?? err,
    };
  }

  return {
    ok: false,
    stage,
    message: err instanceof Error ? err.message : '저장 실패',
    details: err,
  };
}
