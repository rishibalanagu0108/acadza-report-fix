import DOMPurify from "isomorphic-dompurify";
import questions from "../data/questions.json";
import reports from "../data/reports.json";
import results from "../results.json";

type Route = "auto_apply" | "faculty_review" | "no_change";
type Edit = { field: string; find: string; replace: string } | null;
type TriageRow = {
  reportId: string;
  questionId: string;
  verdict: string;
  repair?: string;
  edit: Edit;
  route: Route;
  confidence: number;
  evidence: string;
  student_reply: string;
};
type SourceReport = (typeof reports)[number];
type SourceQuestion = (typeof questions)[number];
type QuestionContent = {
  question?: string;
  solution?: string;
  answer?: string | string[] | number;
};
type ProposedChange = {
  field: string;
  beforeText: string;
  afterText: string;
  beforeHtml: string | null;
  afterHtml: string | null;
  matches: boolean;
};

export type ReviewReport = {
  id: string;
  comment: string;
  reportedAt: string;
  route: Route;
  verdictLabel: string;
  repairLabel: string | null;
  confidence: number;
  evidence: string;
  studentReply: string;
  change: ProposedChange | null;
};

export type ReviewCase = {
  questionId: string;
  questionType: string;
  subject: string;
  chapter: string;
  questionHtml: string;
  solutionHtml: string;
  answer: string;
  queueRoute: Route;
  reports: ReviewReport[];
};

const routeRank: Record<Route, number> = { faculty_review: 0, auto_apply: 1, no_change: 2 };
const verdictNames: Record<string, string> = {
  defect: "Possible question defect",
  student_error: "Likely student error",
  no_error: "No question error found",
  not_actionable: "Not enough information",
  uncertain: "Needs a closer look",
};

function safeHtml(value: string) {
  return DOMPurify.sanitize(value);
}

function plainValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  return value === undefined || value === null ? "" : String(value);
}

function buildChange(
  edit: Edit,
  question: SourceQuestion,
  content: QuestionContent,
): ProposedChange | null {
  if (!edit) return null;

  let beforeText = "";
  if (edit.field === "question") beforeText = content.question ?? "";
  else if (edit.field === "solution") beforeText = content.solution ?? "";
  else if (edit.field === "answer") beforeText = plainValue(content.answer);
  else if (edit.field === "questionType") beforeText = question.questionType;

  const matches = edit.field === "answer" || edit.field === "questionType"
    ? beforeText === edit.find
    : beforeText.includes(edit.find);
  const afterText = matches
    ? edit.field === "answer" || edit.field === "questionType"
      ? edit.replace
      : beforeText.replace(edit.find, edit.replace)
    : edit.replace;
  const isHtml = edit.field === "question" || edit.field === "solution";

  return {
    field: edit.field,
    beforeText,
    afterText,
    beforeHtml: isHtml ? safeHtml(beforeText) : null,
    afterHtml: isHtml ? safeHtml(afterText) : null,
    matches,
  };
}

function routeFor(reportsForQuestion: ReviewReport[]): Route {
  if (reportsForQuestion.some((report) => report.route === "faculty_review")) return "faculty_review";
  if (reportsForQuestion.some((report) => report.route === "auto_apply")) return "auto_apply";
  return "no_change";
}

export function getReviewCases(): ReviewCase[] {
  const questionById = new Map<string, SourceQuestion>(
    (questions as SourceQuestion[]).map((question) => [question._id, question]),
  );
  const sourceReportById = new Map<string, SourceReport>(
    (reports as SourceReport[]).map((report) => [report.reportId, report]),
  );
  const grouped = new Map<string, ReviewCase>();

  for (const row of results as TriageRow[]) {
    const question = questionById.get(row.questionId);
    const sourceReport = sourceReportById.get(row.reportId);
    if (!question || !sourceReport) continue;
    const content = (question as unknown as Record<string, QuestionContent>)[question.questionType] ?? {};
    let reviewCase = grouped.get(row.questionId);

    if (!reviewCase) {
      reviewCase = {
        questionId: row.questionId,
        questionType: question.questionType,
        subject: question.subject ?? "Uncategorized",
        chapter: question.chapter ?? "Uncategorized",
        questionHtml: safeHtml(content.question ?? "Question text unavailable."),
        solutionHtml: safeHtml(content.solution ?? "Solution unavailable."),
        answer: plainValue(content.answer) || "Not supplied",
        queueRoute: row.route,
        reports: [],
      };
      grouped.set(row.questionId, reviewCase);
    }

    reviewCase.reports.push({
      id: row.reportId,
      comment: sourceReport.comment,
      reportedAt: new Date(sourceReport.reportedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
      route: row.route,
      verdictLabel: verdictNames[row.verdict] ?? row.verdict.replaceAll("_", " "),
      repairLabel: row.repair ? row.repair.replaceAll("_", " ") : null,
      confidence: row.confidence,
      evidence: row.evidence,
      studentReply: row.student_reply,
      change: buildChange(row.edit, question, content),
    });
  }

  const cases = [...grouped.values()];
  for (const item of cases) item.queueRoute = routeFor(item.reports);
  return cases.sort(
    (a, b) => routeRank[a.queueRoute] - routeRank[b.queueRoute] ||
      b.reports.length - a.reports.length ||
      a.questionId.localeCompare(b.questionId),
  );
}
