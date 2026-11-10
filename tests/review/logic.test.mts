import assert from "node:assert/strict";
import test from "node:test";
import { createDecision, getProposal, getProposalVersion, ReviewError } from "../../lib/reviews/logic.ts";

const versionFor = (reportId: string) => getProposalVersion(reportId) ?? "";

test("approval saves the exact current proposed edit", () => {
  const decision = createDecision({
    reportId: "R001",
    action: "approve",
    proposalVersion: versionFor("R001"),
    reviewerName: "Rishik",
  });

  assert.equal(decision.action, "approve");
  assert.deepEqual(decision.finalEdit, getProposal("R001")?.edit);
  assert.equal(decision.reason, "");
});

test("an edit changes only the proposed replacement and records its reason", () => {
  const decision = createDecision({
    reportId: "R022",
    action: "edit",
    proposalVersion: versionFor("R022"),
    reviewerName: "Rishik",
    reason: "Corrected spelling after checking the stem.",
    replacement: "Choroid plexus",
  });

  assert.equal(decision.finalEdit?.field, "question");
  assert.equal(decision.finalEdit?.find, "Choroid plexux");
  assert.equal(decision.finalEdit?.replace, "Choroid plexus");
  assert.equal(decision.reason, "Corrected spelling after checking the stem.");
});

test("a rejection has no applied edit and requires a reason", () => {
  const decision = createDecision({
    reportId: "R007",
    action: "reject",
    proposalVersion: versionFor("R007"),
    reviewerName: "Rishik",
    reason: "The proposed value is not supported by the source.",
  });

  assert.equal(decision.finalEdit, null);
  assert.throws(
    () => createDecision({ reportId: "R007", action: "reject", proposalVersion: versionFor("R007"), reviewerName: "Rishik" }),
    (error) => error instanceof ReviewError && error.status === 400,
  );
});

test("stale proposal versions are rejected", () => {
  assert.throws(
    () => createDecision({ reportId: "R001", action: "approve", proposalVersion: "old-version", reviewerName: "Rishik" }),
    (error) => error instanceof ReviewError && error.status === 409,
  );
});

test("an edit keeps the proposed field and exact source match", () => {
  const original = getProposal("R007")?.edit;
  const decision = createDecision({
    reportId: "R007",
    action: "edit",
    proposalVersion: versionFor("R007"),
    reviewerName: "Rishik",
    reason: "Reviewed the source.",
    replacement: "An inductance of 95.5 mH",
  });

  assert.equal(decision.finalEdit?.field, original?.field);
  assert.equal(decision.finalEdit?.find, original?.find);
  assert.equal(decision.finalEdit?.replace, "An inductance of 95.5 mH");
});
