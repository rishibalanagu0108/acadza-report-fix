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
      router.refresh();
    } catch {
      setMessage("Could not reach the review service. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="decision-actions-heading" className="mt-6 border-t border-ink/10 pt-5">
      <h3 id="decision-actions-heading" className="text-xs font-semibold tracking-[0.1em] text-muted">FACULTY DECISION</h3>
      <label className="mt-3 block text-xs font-medium text-ink" htmlFor="reviewer-name">Your name</label>
      <input
        id="reviewer-name"
        value={reviewerName}
        onChange={(event) => setReviewerName(event.target.value)}
        maxLength={80}
        autoComplete="name"
        className="mt-1 h-10 w-full border border-ink/15 bg-white px-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
      />

      {edit && (
        <>
          <label className="mt-4 block text-xs font-medium text-ink" htmlFor="replacement-text">Corrected text</label>
          <textarea
            id="replacement-text"
            value={replacement}
            onChange={(event) => setReplacement(event.target.value)}
            maxLength={2000}
            rows={4}
            className="mt-1 w-full border border-ink/15 bg-white p-3 text-sm leading-relaxed outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </>
      )}

      <label className="mt-4 block text-xs font-medium text-ink" htmlFor="decision-reason">Reason <span className="font-normal text-muted">(required for edit or reject)</span></label>
      <textarea
        id="decision-reason"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={500}
        rows={3}
        className="mt-1 w-full border border-ink/15 bg-white p-3 text-sm leading-relaxed outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
        placeholder="What did you check?"
      />

      <div className="mt-4 grid gap-2">
        <button type="button" disabled={busy} onClick={() => void save("approve")} className="min-h-10 bg-teal px-3 py-2 text-sm font-semibold text-white hover:bg-teal/90 disabled:cursor-wait disabled:opacity-60">Approve proposal</button>
        <button type="button" disabled={busy || !edit} onClick={() => void save("edit")} className="min-h-10 border border-ink/20 bg-white px-3 py-2 text-sm font-semibold hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-45">Save edited proposal</button>
        <button type="button" disabled={busy} onClick={() => void save("reject")} className="min-h-10 border border-red/30 px-3 py-2 text-sm font-semibold text-red hover:bg-red/5 disabled:cursor-wait disabled:opacity-60">Reject proposal</button>
      </div>
      <p role="status" aria-live="polite" className="mt-3 min-h-5 text-xs leading-relaxed text-muted">{message}</p>
    </section>
  );
}
