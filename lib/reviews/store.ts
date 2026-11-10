import { neon } from "@neondatabase/serverless";
import type { DecisionWrite, Edit, ReviewAction } from "./logic";

export type SavedDecision = {
  report_id: string;
  question_id: string;
  proposal_version: string;
  action: ReviewAction;
  final_edit: Edit | null;
  reason: string;
  reviewer_name: string;
  decided_at: string | Date;
};

export type AuditEvent = {
  audit_id: number;
  action: ReviewAction;
  reason: string;
  reviewer_name: string;
  recorded_at: string | Date;
  proposal_version: string;
};

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  return neon(process.env.DATABASE_URL);
}

export async function saveDecision(decision: DecisionWrite) {
  const sql = database();
  const finalEdit = decision.finalEdit === null ? null : JSON.stringify(decision.finalEdit);
  const rows = await sql`
    WITH saved AS (
      INSERT INTO faculty_review_decisions
        (report_id, question_id, proposal_version, action, final_edit, reason, reviewer_name, decided_at)
      VALUES
        (${decision.reportId}, ${decision.questionId}, ${decision.proposalVersion}, ${decision.action}, ${finalEdit}::jsonb, ${decision.reason}, ${decision.reviewerName}, now())
      ON CONFLICT (report_id) DO UPDATE SET
        question_id = EXCLUDED.question_id,
        proposal_version = EXCLUDED.proposal_version,
        action = EXCLUDED.action,
        final_edit = EXCLUDED.final_edit,
        reason = EXCLUDED.reason,
        reviewer_name = EXCLUDED.reviewer_name,
        decided_at = now()
      RETURNING report_id, question_id, proposal_version, action, final_edit, reason, reviewer_name, decided_at
    )
    INSERT INTO faculty_review_audit
      (report_id, question_id, proposal_version, action, final_edit, reason, reviewer_name, recorded_at)
    SELECT report_id, question_id, proposal_version, action, final_edit, reason, reviewer_name, now()
    FROM saved
    RETURNING audit_id, report_id, question_id, proposal_version, action, final_edit, reason, reviewer_name, recorded_at
  `;
  return rows[0] as SavedDecision | undefined;
}

export async function getDecisionBundle(reportId: string) {
  const sql = database();
  const [decisions, events] = await Promise.all([
    sql`
      SELECT report_id, question_id, proposal_version, action, final_edit, reason, reviewer_name, decided_at
      FROM faculty_review_decisions
      WHERE report_id = ${reportId}
      LIMIT 1
    `,
    sql`
      SELECT audit_id, action, reason, reviewer_name, recorded_at, proposal_version
      FROM faculty_review_audit
      WHERE report_id = ${reportId}
      ORDER BY recorded_at DESC, audit_id DESC
      LIMIT 20
    `,
  ]);
  return {
    decision: (decisions[0] as SavedDecision | undefined) ?? null,
    events: events as AuditEvent[],
  };
}
