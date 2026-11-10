import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import DOMPurify from "isomorphic-dompurify";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("every triage result joins to one source report and question", async () => {
  const [questions, reports, results] = await Promise.all([
    readJson("../data/questions.json"),
    readJson("../data/reports.json"),
    readJson("../results.json"),
  ]);
  const questionIds = new Set(questions.map((question) => question._id));
  const reportIds = new Set(reports.map((report) => report.reportId));
  const resultIds = new Set(results.map((result) => result.reportId));

  assert.equal(results.length, 44);
  assert.equal(resultIds.size, 44);
  assert.equal(reports.length, 44);
  assert.equal(results.filter((result) => reportIds.has(result.reportId) && questionIds.has(result.questionId)).length, 44);
  assert.equal(new Set(results.map((result) => result.questionId)).size, 39);
});

test("question markup is sanitized while MathML stays renderable", () => {
  const clean = DOMPurify.sanitize(
    '<p onclick="alert(1)">Value <math><mfrac><mn>2</mn><mn>3</mn></mfrac></math></p><script>alert(1)</script><img src=x onerror="alert(1)">',
  );

  assert.doesNotMatch(clean, /<script|onclick|onerror/i);
  assert.match(clean, /<math[\s>]/i);
  assert.match(clean, /<mfrac[\s>]/i);
});
