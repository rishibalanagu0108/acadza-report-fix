"""One contract check for the real snapshot and scored output shape."""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.validate_data import ROOT, load_inputs, validate_inputs


class ContractTest(unittest.TestCase):
    def test_supplied_snapshot(self):
        questions, reports, taxonomy = load_inputs()
        by_question, by_report = validate_inputs(questions, reports, taxonomy)
        self.assertEqual((len(by_question), len(by_report)), (43, 44))
        self.assertEqual(len({report["questionId"] for report in reports}), 39)

    def test_result_file_contract(self):
        _, reports, _ = load_inputs()
        rows = [
            {"reportId": report["reportId"], "questionId": report["questionId"], "verdict": "no_error", "repair": None, "edit": None, "route": "no_change", "confidence": 0.5, "evidence": "Checked against the saved question.", "student_reply": "Thanks for reporting this. We checked the question."}
            for report in reports
        ]
        next(row for row in rows if row["reportId"] == "R001").update(
            verdict="defect", repair="answer_key", edit={"field": "answer", "find": "C", "replace": "A"}, route="auto_apply"
        )

        def check(candidate):
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / "results.json"
                path.write_text(json.dumps(candidate))
                return subprocess.run([sys.executable, "scripts/validate_results.py", str(path)], cwd=ROOT, capture_output=True, text=True)

        self.assertEqual(check(rows).returncode, 0)
        for change in ("missing", "duplicate", "unknown_verdict", "wrong_question", "missing_field", "bad_route", "bad_edit"):
            candidate = json.loads(json.dumps(rows))
            if change == "missing":
                candidate.pop()
            elif change == "duplicate":
                candidate[1]["reportId"] = candidate[0]["reportId"]
            elif change == "unknown_verdict":
                candidate[0]["verdict"] = "whatever"
            elif change == "wrong_question":
                candidate[0]["questionId"] = "not-the-question"
            elif change == "bad_route":
                candidate[0]["route"] = []
            elif change == "bad_edit":
                candidate[0].update(verdict="defect", repair="spelling", route="faculty_review", edit={"field": [], "find": "a", "replace": "b"})
            else:
                del candidate[0]["student_reply"]
            with self.subTest(change=change):
                result = check(candidate)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
