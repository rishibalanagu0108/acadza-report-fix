import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import { ReviewActions } from "../components/review-actions";
import { getReviewCases } from "../lib/review-data";
import { getProposal, getProposalVersion, reviewedValue } from "../lib/reviews/logic";
import { getDecisionBundle } from "../lib/reviews/store";

type SearchParams = Promise<{ q?: string; route?: string; question?: string; report?: string }>;

const routeNames = {
  faculty_review: "Faculty review",
  auto_apply: "Potential fix",
  no_change: "No change",
} as const;

function routeStyle(route: string) {
  if (route === "faculty_review") return "border-amber/25 bg-amber/10 text-amber";
  if (route === "auto_apply") return "border-teal/20 bg-teal/10 text-teal";
  return "border-ink/10 bg-ink/[0.04] text-muted";
}

function hrefFor(params: { q: string; route: string; question?: string; report?: string }) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.route !== "all") query.set("route", params.route);
  if (params.question) query.set("question", params.question);
  if (params.report) query.set("report", params.report);
  const suffix = query.toString();
  return `/${suffix ? `?${suffix}` : ""}${params.question ? "#case-detail" : ""}`;
}

function formatTime(value: string | Date) {
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = (params.q ?? "").trim().toLowerCase();
  const routeFilter = ["faculty_review", "auto_apply", "no_change"].includes(params.route ?? "")
    ? params.route!
    : "all";
  const allCases = getReviewCases();
  const cases = allCases.filter((item) => {
    const routeMatches = routeFilter === "all" || item.queueRoute === routeFilter;
    const haystack = `${item.questionId} ${item.subject} ${item.chapter} ${item.reports
      .map((report) => `${report.id} ${report.comment}`)
      .join(" ")}`.toLowerCase();
    return routeMatches && (!query || haystack.includes(query));
  });
  const activeCase =
    cases.find((item) => item.questionId === params.question) ??
    cases[0];
  const activeReport =
    activeCase?.reports.find((report) => report.id === params.report) ?? activeCase?.reports[0];
  const proposalVersion = activeReport ? getProposalVersion(activeReport.id) : null;
  let reviewBundle: Awaited<ReturnType<typeof getDecisionBundle>> | null = null;
  if (activeReport) {
    try {
      reviewBundle = await getDecisionBundle(activeReport.id);
    } catch {
      reviewBundle = null;
    }
  }
  const savedDecision = reviewBundle?.decision ?? null;
  const decisionIsStale = !!savedDecision && savedDecision.proposal_version !== proposalVersion;
  const currentDecision = savedDecision && !decisionIsStale ? savedDecision : null;
  const reviewed = currentDecision && ["approve", "edit"].includes(currentDecision.action)
    ? reviewedValue(activeCase?.questionId ?? "", currentDecision.final_edit)
    : null;
  const routeCounts = Object.fromEntries(
    ["faculty_review", "auto_apply", "no_change"].map((route) => [
      route,
      allCases.filter((item) => item.queueRoute === route).length,
    ]),
  ) as Record<"faculty_review" | "auto_apply" | "no_change", number>;

  const filters = [
    { id: "all", label: "All cases", count: allCases.length },
    { id: "faculty_review", label: "Faculty review", count: routeCounts.faculty_review },
    { id: "auto_apply", label: "Potential fixes", count: routeCounts.auto_apply },
    { id: "no_change", label: "No change", count: routeCounts.no_change },
  ];

  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-paper/10 bg-shell px-4 text-paper sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center bg-coral text-xs font-bold tracking-tight text-shell">A</span>
          <span className="truncate text-sm font-semibold tracking-wide">Acadza <span className="font-normal text-paper/55">/ Review Desk</span></span>
        </div>
        <div className="flex items-center gap-4 text-xs text-paper/65 sm:gap-7">
          <span className="hidden sm:inline">Question quality</span>
          <span className="border-l border-paper/20 pl-4 sm:pl-7">Faculty workspace</span>
        </div>
      </header>

      <section className="border-b border-ink/10 bg-paper px-4 py-4 sm:px-6 xl:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-muted">
              <span>CONTENT QUALITY</span><span aria-hidden="true">/</span><span>REPORT QUEUE</span>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-[28px]">Review queue</h1>
              <p className="text-sm text-muted">44 student reports across 39 questions</p>
            </div>
          </div>
            <form action="/" className="flex w-full max-w-md items-center gap-2 lg:w-auto">
            {routeFilter !== "all" && <input type="hidden" name="route" value={routeFilter} />}
            <label className="sr-only" htmlFor="case-search">Search reports</label>
            <input
              id="case-search"
              type="search"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search question, report, or comment"
              className="h-10 min-w-0 flex-1 border border-ink/15 bg-white px-3 text-sm outline-none placeholder:text-muted/70 focus:border-coral focus:ring-2 focus:ring-coral/20 lg:w-80"
            />
            <button className="h-10 border border-ink/15 px-4 text-sm font-medium hover:bg-canvas focus-visible:outline-2 focus-visible:outline-coral">Search</button>
          </form>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1600px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
        <nav aria-label="Question cases" className="border-b border-ink/10 bg-shell text-paper lg:sticky lg:top-0 lg:max-h-[calc(100dvh-0px)] lg:overflow-y-auto lg:border-b-0 lg:border-r lg:border-paper/10 xl:h-dvh">
          <div className="sticky top-0 z-10 border-b border-paper/10 bg-shell px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-[0.14em] text-paper/55">CASE QUEUE</p>
              <span className="font-mono text-xs text-paper/45">{cases.length.toString().padStart(2, "0")}</span>
            </div>
            <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
              {filters.map((filter) => {
                const selected = routeFilter === filter.id;
                return (
                  <Link
                    key={filter.id}
                    href={hrefFor({ q: params.q ?? "", route: filter.id })}
                    aria-current={selected ? "page" : undefined}
                    className={`shrink-0 px-2.5 py-2 text-[11px] ${selected ? "bg-paper text-shell" : "text-paper/60 hover:bg-paper/10 hover:text-paper"}`}
                  >
                    {filter.label} <span className={selected ? "text-muted" : "text-paper/40"}>{filter.count}</span>
                  </Link>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-paper/40">Priority: faculty review first, then report count.</p>
          </div>

          <div className="max-h-[50dvh] overflow-y-auto lg:max-h-none">
            {cases.length === 0 ? (
              <p className="px-5 py-8 text-sm text-paper/55">No cases match this search.</p>
            ) : cases.map((item) => {
              const selected = item.questionId === activeCase?.questionId;
              return (
                <Link
                  key={item.questionId}
                  href={hrefFor({ q: params.q ?? "", route: routeFilter, question: item.questionId, report: item.reports[0]?.id })}
                  aria-current={selected ? "location" : undefined}
                  className={`block border-b border-paper/10 border-l-2 px-4 py-3.5 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-coral sm:px-5 ${selected ? "border-l-coral bg-paper/10" : "border-l-transparent hover:bg-paper/[0.06]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-mono text-xs text-paper/55">{item.questionId.slice(-8).toUpperCase()}</span>
                    <span className={`border px-1.5 py-0.5 text-[10px] ${routeStyle(item.queueRoute)}`}>{routeNames[item.queueRoute]}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-snug text-paper">{item.chapter}</p>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-paper/45">
                    <span>{item.subject}</span>
                    <span>{item.reports.length} {item.reports.length === 1 ? "report" : "reports"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {activeCase && activeReport ? (
          <>
            <article id="case-detail" className="min-w-0 px-4 py-5 sm:px-7 sm:py-7 xl:px-9 xl:py-8">
              <div className="mx-auto max-w-3xl">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>{activeCase.subject}</span><span aria-hidden="true">/</span><span>{activeCase.chapter}</span><span aria-hidden="true">/</span><span>{activeCase.questionType}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-mono text-sm font-semibold tabular-nums">Question {activeCase.questionId}</h2>
                    <p className="mt-1 text-sm text-muted">{activeCase.reports.length} student {activeCase.reports.length === 1 ? "report" : "reports"} · Latest report {activeReport.reportedAt}</p>
                  </div>
                  <span className={`border px-2.5 py-1 text-xs font-medium ${routeStyle(activeCase.queueRoute)}`}>{routeNames[activeCase.queueRoute]}</span>
                </div>

                <section aria-labelledby="question-heading" className="mt-7 border border-ink/10 bg-paper p-5 sm:p-7">
                  <div className="flex items-center justify-between border-b border-ink/10 pb-3">
                    <h3 id="question-heading" className="text-xs font-semibold tracking-[0.12em] text-muted">SAVED QUESTION</h3>
                    <span className="font-mono text-[10px] text-muted">{activeCase.questionType.toUpperCase()}</span>
                  </div>
                  <div className="question-copy mt-5 text-[16px] leading-7 sm:text-[17px]" dangerouslySetInnerHTML={{ __html: activeCase.questionHtml }} />
                  <div className="mt-7 border-t border-ink/10 pt-5">
                    <p className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted">SAVED ANSWER</p>
                    <p className="font-mono text-base font-semibold">{activeCase.answer}</p>
                  </div>
                  <details className="mt-6 border-t border-ink/10 pt-4">
                    <summary className="cursor-pointer text-sm font-medium marker:text-coral">Open saved solution</summary>
                    <div className="question-copy mt-4 text-[15px] leading-7" dangerouslySetInnerHTML={{ __html: activeCase.solutionHtml }} />
                  </details>
                  {reviewed && (
                    <section className="mt-6 border-t border-teal/20 pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-teal">APPROVED DEMO VERSION</p>
                        <span className="border border-teal/20 bg-teal/5 px-2 py-0.5 text-[10px] font-medium text-teal">{reviewed.field}</span>
                      </div>
                      {reviewed.field === "question" || reviewed.field === "solution" ? (
                        <div className="question-copy mt-3 text-[15px] leading-7" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reviewed.value) }} />
                      ) : (
                        <p className="mt-3 break-words font-mono text-base font-semibold">{reviewed.value}</p>
                      )}
                      <p className="mt-3 text-xs leading-relaxed text-muted">This approved version is shown in the demo. The supplied source files remain unchanged.</p>
                    </section>
                  )}
                </section>

                <section aria-labelledby="reports-heading" className="mt-7">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 id="reports-heading" className="text-sm font-semibold">Student reports</h3>
                    <span className="text-xs text-muted">Select a report to inspect its assessment</span>
                  </div>
                  <div className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
                    {activeCase.reports.map((report) => {
                      const selected = report.id === activeReport.id;
                      return (
                        <Link
                          key={report.id}
                          href={hrefFor({ q: params.q ?? "", route: routeFilter, question: activeCase.questionId, report: report.id })}
                          aria-current={selected ? "true" : undefined}
                          className={`block py-4 focus-visible:outline-2 focus-visible:outline-coral ${selected ? "border-l-2 border-coral pl-3" : "pl-4 hover:bg-paper/50"}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold">{report.id}</span>
                            <span className={`border px-2 py-0.5 text-[10px] ${routeStyle(report.route)}`}>{routeNames[report.route]}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/85">{report.comment}</p>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              </div>
            </article>

            <aside aria-label="AI assessment" className="border-t border-ink/10 bg-[#f7f5f0] lg:col-span-2 xl:sticky xl:top-0 xl:col-span-1 xl:h-[calc(100dvh-9.5rem)] xl:min-h-[34rem] xl:overflow-hidden xl:border-l xl:border-t-0">
              <div className="xl:grid xl:h-full xl:grid-rows-[minmax(0,1fr)_auto]">
               <div className="px-4 py-5 sm:px-7 sm:py-7 xl:min-h-0 xl:overflow-y-auto xl:px-6 xl:py-6">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-muted">AI ASSESSMENT</p>
                  <span className="font-mono text-xs text-muted">{activeReport.id}</span>
                </div>
                <div className="mt-4 border-l-2 border-coral pl-4">
                  <p className="text-lg font-semibold leading-snug">{activeReport.verdictLabel}</p>
                  <p className="mt-1 text-sm text-muted">{activeReport.repairLabel ?? "No repair proposed"}</p>
                </div>
                <div className="mt-5 flex items-center justify-between border-y border-ink/10 py-3 text-sm">
                  <span className="text-muted">Confidence</span>
                  <span className="font-mono font-medium">{Math.round(activeReport.confidence * 100)}%</span>
                </div>
                <section className="mt-5">
                  <h3 className="text-xs font-semibold tracking-[0.1em] text-muted">WHY IT WAS FLAGGED</h3>
                  <p className="mt-2 text-sm leading-relaxed">{activeReport.evidence}</p>
                </section>

                <section className="mt-6 border-t border-ink/10 pt-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-xs font-semibold tracking-[0.1em] text-muted">PROPOSED CHANGE</h3>
                    {activeReport.change && <span className="font-mono text-[10px] text-muted">{activeReport.change.field}</span>}
                  </div>
                  {activeReport.change ? (
                    <>
                      {!activeReport.change.matches && <p className="mt-2 border border-red/20 bg-red/5 p-2 text-xs text-red">The saved text does not match this proposal exactly.</p>}
                      <div className="mt-3 grid gap-2">
                        <div className="border border-ink/10 bg-white p-3">
                          <p className="mb-2 text-[10px] font-semibold tracking-widest text-muted">BEFORE</p>
                          {activeReport.change.beforeHtml !== null ? (
                            <div className="question-copy text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: activeReport.change.beforeHtml }} />
                          ) : <p className="break-words font-mono text-sm">{activeReport.change.beforeText || "(empty)"}</p>}
                        </div>
                        <div className="border border-teal/20 bg-teal/5 p-3">
                          <p className="mb-2 text-[10px] font-semibold tracking-widest text-teal">AFTER</p>
                          {activeReport.change.afterHtml !== null ? (
                            <div className="question-copy text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: activeReport.change.afterHtml }} />
                          ) : <p className="break-words font-mono text-sm">{activeReport.change.afterText || "(empty)"}</p>}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="mt-3 border border-ink/10 bg-white p-3 text-sm text-muted">No question change proposed. The saved content stays as it is.</p>
                  )}
                  {activeReport.route === "auto_apply" && <p className="mt-3 text-xs leading-relaxed text-muted">This result is marked eligible for an automatic route after validation. The batch checker has not changed the saved question.</p>}
                </section>

                <section className="mt-6 border-t border-ink/10 pt-5">
                  <h3 className="text-xs font-semibold tracking-[0.1em] text-muted">STUDENT REPLY PREVIEW</h3>
                  <blockquote className="mt-2 border-l border-ink/20 pl-3 text-sm leading-relaxed text-ink/80">{activeReport.studentReply}</blockquote>
                </section>
                {reviewBundle && reviewBundle.events.length > 0 && (
                  <section className="mt-6 border-t border-ink/10 pt-5">
                    <h3 className="text-xs font-semibold tracking-[0.1em] text-muted">REVIEW HISTORY</h3>
                    <ol className="mt-3 space-y-3">
                      {reviewBundle.events.map((event) => (
                        <li key={event.audit_id} className="border-l border-ink/15 pl-3">
                          <p className="text-sm font-medium capitalize">{event.action} · {event.reviewer_name}</p>
                          <p className="mt-0.5 text-[11px] text-muted">{formatTime(event.recorded_at)}</p>
                          {event.reason && <p className="mt-1 text-xs leading-relaxed text-muted">{event.reason}</p>}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
                <p className="mt-6 border-t border-ink/10 pt-4 text-xs leading-relaxed text-muted">AI suggestions need faculty judgment before a question is changed.</p>
               </div>

               <div className="border-t border-ink/15 bg-paper px-4 py-4 sm:px-7 xl:px-5 xl:py-4">
                {currentDecision ? (
                  <div className="mb-3 flex items-start justify-between gap-3 border-l-2 border-teal pl-3">
                    <div>
                      <p className="text-[10px] font-semibold tracking-[0.12em] text-muted">CURRENT DECISION</p>
                      <p className="mt-0.5 text-sm font-semibold capitalize">{currentDecision.action}{currentDecision.action === "reject" ? " · source unchanged" : " · saved"}</p>
                      {currentDecision.reason && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted">{currentDecision.reason}</p>}
                    </div>
                    <p className="max-w-[46%] text-right text-[10px] leading-relaxed text-muted">{currentDecision.reviewer_name}<br />{formatTime(currentDecision.decided_at)}</p>
                  </div>
                ) : decisionIsStale ? (
                  <p className="mb-3 border-l-2 border-amber pl-3 text-xs leading-relaxed text-amber">An earlier decision is out of date and has not been applied to the demo version.</p>
                ) : null}

                {reviewBundle ? (
                  <ReviewActions
                    key={activeReport.id}
                    reportId={activeReport.id}
                    proposalVersion={proposalVersion ?? ""}
                    edit={getProposal(activeReport.id)?.edit ?? null}
                    initialReviewerName={currentDecision?.reviewer_name ?? savedDecision?.reviewer_name ?? ""}
                  />
                ) : (
                  <p className="text-xs leading-relaxed text-muted">Review saving is unavailable right now. The report and proposed change are still available to inspect.</p>
                )}
               </div>
              </div>
            </aside>
          </>
        ) : (
          <section className="px-6 py-16 lg:col-span-1 xl:col-span-2">
            <p className="text-sm text-muted">No reported questions match these filters.</p>
          </section>
        )}
      </div>
    </main>
  );
}
