import unittest

from scripts.triage import apply_report_guards, groups_by_question, merge_group, response_text, triage_schema


class TriageTest(unittest.TestCase):
    def test_reports_group_by_question_and_sort(self):
        reports = [
            {"reportId": "R002", "questionId": "Q1"},
            {"reportId": "R003", "questionId": "Q2"},
            {"reportId": "R001", "questionId": "Q1"},
        ]
        groups = groups_by_question(reports)
        self.assertEqual(list(groups), ["Q1", "Q2"])
        self.assertEqual([row["reportId"] for row in groups["Q1"]], ["R001", "R002"])

    def test_triage_schema_requires_exact_report_ids(self):
        schema = triage_schema(["R1"], {"verdicts": {"defect": ""}, "repairs": {"spelling": {}}})
        item = schema["properties"]["analyses"]["items"]
        self.assertEqual(item["properties"]["reportId"]["enum"], ["R1"])
        self.assertEqual(item["additionalProperties"], False)
        self.assertIn("edit", item["required"])

    def test_extract_response_text(self):
        self.assertEqual(response_text({"output_text": "{}"}), "{}")
        self.assertEqual(response_text({"output": [{"content": [{"type": "output_text", "text": "{}"}]}]}), "{}")
        with self.assertRaisesRegex(RuntimeError, "refused"):
            response_text({"output": [{"content": [{"type": "refusal"}]}]})

    def test_group_merge_routes_unconfirmed_edit_to_faculty(self):
        question = {"_id": "Q1", "questionType": "scq", "scq": {"question": "Question text", "solution": "Work", "answer": "A"}}
        report = {"reportId": "R1", "questionId": "Q1"}
        taxonomy = {
            "verdicts": {"defect": "", "no_error": ""},
            "repairs": {"answer_key": {"fields": ["answer", "solution"], "auto": True}},
        }
        candidate = {
            "reportId": "R1", "verdict": "defect", "repair": "answer_key",
            "edit": {"field": "answer", "find": "A", "replace": "B"},
            "confidence": 0.9, "evidence": "The solution ends at B.", "student_reply": "Thanks for reporting this.",
        }
        independent = {"conclusion": "uncertain", "repair": None, "edit": None, "evidence": "The answer cannot be confirmed."}
        result = merge_group(question, [report], [candidate], independent, taxonomy)[0]
        self.assertEqual(result["route"], "faculty_review")
        self.assertEqual(result["edit"], candidate["edit"])
        self.assertIn("Independent check", result["evidence"])

    def test_non_defect_edit_is_discarded(self):
        question = {"_id": "Q1", "questionType": "scq", "scq": {"question": "Question text", "solution": "Work", "answer": "A"}}
        report = {"reportId": "R1", "questionId": "Q1"}
        taxonomy = {"verdicts": {"no_error": ""}, "repairs": {"spelling": {"fields": ["question"], "auto": True}}}
        candidate = {
            "reportId": "R1", "verdict": "no_error", "repair": "spelling",
            "edit": {"field": "question", "find": "foo", "replace": "bar"},
            "confidence": 0.9, "evidence": "Question is correct.", "student_reply": "Thanks for reporting this.",
        }
        independent = {"conclusion": "no_defect", "repair": None, "edit": None, "evidence": "The question checks out."}
        result = merge_group(question, [report], [candidate], independent, taxonomy)[0]
        self.assertEqual(result["route"], "no_change")
        self.assertIsNone(result["repair"])
        self.assertIsNone(result["edit"])
        self.assertIn("discarded", result["evidence"])

    def test_report_guards_only_route_ambiguous_cases_to_faculty(self):
        questions = [
            {"_id": "Q1", "questionType": "scq", "scq": {"question": "Stem (A) one (B) two (C) three", "solution": "Work", "answer": "C"}},
            {"_id": "Q2", "questionType": "scq", "scq": {"question": r"Stem \frac{1}{2} (A) one (B) two (C) three (D) four", "solution": "Work", "answer": "A"}},
            {"_id": "Q3", "questionType": "scq", "scq": {"question": "Evolution question (A) one (B) two (C) three (D) four", "solution": "Work", "answer": "A"}},
        ]
        reports = [
            {"reportId": "R1", "questionId": "Q1", "comment": "Option D is missing"},
            {"reportId": "R2", "questionId": "Q2", "comment": "Some code is showing \\frac in the question"},
            {"reportId": "R3", "questionId": "Q3", "comment": "Out of syllabus for NEET"},
        ]
        rows = [{
            "reportId": report["reportId"], "questionId": report["questionId"], "verdict": "no_error",
            "repair": None, "edit": None, "route": "no_change", "confidence": 0.9,
            "evidence": "Initial check found no issue.", "student_reply": "Thanks for reporting this.",
        } for report in reports]
        taxonomy = {"repairs": {"option_repair": {}, "markup_leak": {}, "syllabus": {}}}
        guarded = apply_report_guards(rows, reports, questions, taxonomy)
        self.assertEqual([row["route"] for row in guarded], ["faculty_review"] * 3)
        self.assertEqual([row["repair"] for row in guarded], ["option_repair", "markup_leak", "syllabus"])
        self.assertTrue(all(row["edit"] is None for row in guarded))


if __name__ == "__main__":
    unittest.main()
