import { createHash } from "node:crypto";
import questions from "../../data/questions.json" with { type: "json" };
import reports from "../../data/reports.json" with { type: "json" };
import results from "../../results.json" with { type: "json" };
import taxonomy from "../../data/taxonomy.json" with { type: "json" };

export type ReviewAction = "approve" | "edit" | "reject";
export type Edit = { field: string; find: string; replace: string };
export type DecisionInput = {
  reportId: string;
  action: ReviewAction;
  proposalVersion: string;
  reviewerName: string;
  reason?: string;
  replacement?: string;
};
export type DecisionWrite = {
  reportId: string;
  questionId: string;
  proposalVersion: string;
  action: ReviewAction;
  finalEdit: Edit | null;
  reason: string;
  reviewerName: string;
};

type Proposal = {
  reportId: string;
  questionId: string;
  verdict: string;
  repair?: string;
  edit: Edit | null;
  route: string;
};
type Question = (typeof questions)[number];

export class ReviewError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const proposals = results as Proposal[];
const questionById = new Map<string, Question>((questions as Question[]).map((item) => [item._id, item]));
const reportIds = new Set(reports.map((report) => report.reportId));

export function getProposal(reportId: string) {
  return proposals.find((item) => item.reportId === reportId) ?? null;
}

export function getProposalVersion(reportId: string) {
  const proposal = getProposal(reportId);
  if (!proposal) return null;
  return createHash("sha256").update(JSON.stringify(proposal)).digest("hex");
}

function matchesSource(question: Question, edit: Edit) {
  const questionRecord = question as unknown as Record<string, unknown>;
  const content = questionRecord[question.questionType] as Record<string, unknown> | undefined;
  const saved = edit.field === "questionType" ? question.questionType : content?.[edit.field];
  if (typeof saved !== "string") return false;
  if (edit.field === "answer" || edit.field === "questionType") return saved === edit.find;
  return edit.find.length > 0 && saved.split(edit.find).length === 2;
}

function assertAllowedEdit(proposal: Proposal, question: Question, edit: Edit) {
  const repair = proposal.repair ? taxonomy.repairs[proposal.repair as keyof typeof taxonomy.repairs] : null;
  if (proposal.verdict !== "defect" || !repair || !repair.fields.includes(edit.field as never)) {
    throw new ReviewError("This proposal is outside the repair rules.", 422);
  }
  if (typeof edit.find !== "string" || typeof edit.replace !== "string" || !matchesSource(question, edit)) {
    throw new ReviewError("The proposed change no longer matches the saved question.", 409);
  }
}

export function createDecision(input: DecisionInput): DecisionWrite {
  if (!["approve", "edit", "reject"].includes(input.action)) {
    throw new ReviewError("Choose approve, edit, or reject.", 400);
  }
  if (typeof input.reviewerName !== "string" || input.reviewerName.trim().length < 2 || input.reviewerName.trim().length > 80) {
    throw new ReviewError("Enter your name (2–80 characters).", 400);
  }
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length > 500) throw new ReviewError("The reason must be 500 characters or fewer.", 400);
  if ((input.action === "edit" || input.action === "reject") && !reason) {
    throw new ReviewError("A reason is required for edits and rejections.", 400);
  }

  const proposal = getProposal(input.reportId ?? "");
  if (!proposal || !reportIds.has(proposal.reportId)) throw new ReviewError("Report not found.", 404);
  const question = questionById.get(proposal.questionId);
  if (!question) throw new ReviewError("Question not found.", 404);
  const currentVersion = getProposalVersion(proposal.reportId);
  if (!currentVersion || input.proposalVersion !== currentVersion) {
    throw new ReviewError("This proposal changed since it was opened. Reload it before deciding.", 409);
  }

  let finalEdit = proposal.edit;
  if (input.action === "reject") finalEdit = null;
  if (input.action === "edit") {
    if (!proposal.edit) throw new ReviewError("There is no proposed edit to change.", 422);
    if (typeof input.replacement !== "string" || input.replacement.length > 2000) {
      throw new ReviewError("Enter a replacement of 2,000 characters or fewer.", 400);
    }
    finalEdit = { ...proposal.edit, replace: input.replacement };
    if (finalEdit.find === finalEdit.replace) throw new ReviewError("The edited text must change the saved value.", 422);
  }

  if (finalEdit) assertAllowedEdit(proposal, question, finalEdit);

  return {
    reportId: proposal.reportId,
    questionId: proposal.questionId,
    proposalVersion: currentVersion,
    action: input.action,
    finalEdit,
    reason,
    reviewerName: input.reviewerName.trim(),
  };
}

export function reviewedValue(questionId: string, edit: Edit | null) {
  if (!edit) return null;
  const question = questionById.get(questionId);
  if (!question || !matchesSource(question, edit)) return null;
  const content = (question as unknown as Record<string, Record<string, unknown>>)[question.questionType];
  const before = edit.field === "questionType" ? question.questionType : content[edit.field];
  const value = edit.field === "questionType" || edit.field === "answer"
    ? edit.replace
    : (before as string).replace(edit.find, edit.replace);
  return { field: edit.field, value };
}
