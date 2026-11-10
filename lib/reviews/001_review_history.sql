CREATE TABLE IF NOT EXISTS faculty_review_decisions (
  report_id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL,
  proposal_version TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'edit', 'reject')),
  final_edit JSONB,
  reason TEXT NOT NULL DEFAULT '',
  reviewer_name TEXT NOT NULL CHECK (length(reviewer_name) BETWEEN 2 AND 80),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS faculty_review_audit (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  proposal_version TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approve', 'edit', 'reject')),
  final_edit JSONB,
  reason TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faculty_review_audit_report_time_idx
  ON faculty_review_audit (report_id, recorded_at DESC, audit_id DESC);
