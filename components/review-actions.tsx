"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Edit, ReviewAction } from "../lib/reviews/logic";

type Props = {
  reportId: string;
  proposalVersion: string;
  edit: Edit | null;
  initialReviewerName: string;
};

export function ReviewActions({ reportId, proposalVersion, edit, initialReviewerName }: Props) {
  const router = useRouter();
  const [reviewerName, setReviewerName] = useState(initialReviewerName);
  const [reason, setReason] = useState("");
  const [replacement, setReplacement] = useState(edit?.replace ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ready" | "edit" | "reject">("ready");

  async function save(action: ReviewAction) {
    if (!reviewerName.trim()) {
      setMessage("Enter your name so the audit record shows who reviewed this case.");
      return;
    }
    if ((action === "edit" || action === "reject") && !reason.trim()) {
      setMessage("Add a short reason for the edit or rejection.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(reportId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, proposalVersion, reviewerName, reason, replacement }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Could not save this decision.");
        if (response.status === 409) router.refresh();
        return;
      }
      setMessage("Decision saved. The review history has been updated.");
      setReason("");
      setMode("ready");
      router.refresh();
    } catch {
      setMessage("Could not reach the review service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="decision-actions-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="decision-actions-heading" className="text-sm font-semibold tracking-tight text-ink">Faculty decision</h3>
        <span className="text-[11px] text-muted">Choose an action</span>
      </div>
      <label className="mt-3 block text-[11px] font-medium text-muted" htmlFor="reviewer-name">REVIEWER</label>
      <input
        id="reviewer-name"
        value={reviewerName}
        onChange={(event) => setReviewerName(event.target.value)}
        maxLength={80}
        autoComplete="name"
        placeholder="Your name"
        className="mt-1 h-9 w-full border border-ink/15 bg-white px-3 text-sm outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
      />

      {mode !== "ready" && (
        <>
          {mode === "edit" && (
            <>
              <label className="mt-3 block text-[11px] font-medium text-muted" htmlFor="replacement-text">CORRECTED TEXT</label>
              <textarea
                id="replacement-text"
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                maxLength={2000}
                rows={3}
                className="mt-1 w-full resize-y border border-ink/15 bg-white p-2.5 text-sm leading-relaxed outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
              />
            </>
          )}
          <label className="mt-3 block text-[11px] font-medium text-muted" htmlFor="decision-reason">
            REASON <span className="font-normal normal-case tracking-normal">(required)</span>
          </label>
          <textarea
            id="decision-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            className="mt-1 w-full resize-y border border-ink/15 bg-white p-2.5 text-sm leading-relaxed outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/15"
            placeholder={mode === "reject" ? "Why should this proposal be rejected?" : "What did you correct?"}
          />
        </>
      )}

      {mode === "ready" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => void save("approve")} className="col-span-2 min-h-10 bg-teal px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal/90 active:translate-y-px disabled:cursor-wait disabled:opacity-60">Approve proposal</button>
          {edit && <button type="button" disabled={busy} onClick={() => { setMode("edit"); setMessage(""); }} className="min-h-10 border border-ink/15 bg-white px-3 py-2 text-sm font-semibold transition hover:bg-canvas active:translate-y-px disabled:cursor-wait disabled:opacity-60">Edit proposal</button>}
          <button type="button" disabled={busy} onClick={() => { setMode("reject"); setMessage(""); }} className={`min-h-10 border border-red/25 bg-white px-3 py-2 text-sm font-semibold text-red transition hover:bg-red/5 active:translate-y-px disabled:cursor-wait disabled:opacity-60 ${edit ? "" : "col-span-2"}`}>Reject proposal</button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={() => void save(mode === "edit" ? "edit" : "reject")} className="min-h-10 bg-teal px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal/90 active:translate-y-px disabled:cursor-wait disabled:opacity-60">{busy ? "Saving…" : mode === "edit" ? "Save edit" : "Confirm rejection"}</button>
          <button type="button" disabled={busy} onClick={() => { setMode("ready"); setReason(""); setMessage(""); }} className="min-h-10 border border-ink/15 bg-white px-3 py-2 text-sm font-semibold transition hover:bg-canvas disabled:opacity-60">Cancel</button>
        </div>
      )}
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs leading-relaxed text-muted">{message}</p>
    </section>
  );
}
