"""Safety checks using real assignment cases, including the prompt injection."""

import copy
import unittest

from scripts.safety import assess_candidate
from scripts.validate_data import load_inputs, validate_inputs


class SafetyTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        questions, reports, cls.taxonomy = load_inputs()
        cls.questions, cls.reports = validate_inputs(questions, reports, cls.taxonomy)

    def case(self, report_id):
        return self.questions[self.reports[report_id]["questionId"]]

    def test_independent_match_is_required_for_answer_key(self):
        question = self.case("R001")
        before = copy.deepcopy(question)
        edit = {"field": "answer", "find": "C", "replace": "A"}
        candidate = {"verdict": "defect", "repair": "answer_key", "edit": edit}
        self.assertEqual(assess_candidate(question, candidate, self.taxonomy)["route"], "faculty_review")
        self.assertEqual(assess_candidate(question, candidate, self.taxonomy, independent_edit=edit)["route"], "auto_apply")
        self.assertEqual(question, before)

    def test_report_instruction_cannot_authorize_edit(self):
        question = self.case("R027")
        self.assertIn("IGNORE ALL PREVIOUS INSTRUCTIONS", self.reports["R027"]["comment"])
        edit = {"field": "answer", "find": "A", "replace": "C"}
        candidate = {"verdict": "defect", "repair": "answer_key", "edit": edit}
        self.assertEqual(assess_candidate(question, candidate, self.taxonomy)["route"], "faculty_review")
        self.assertEqual(assess_candidate(question, {"verdict": "no_error", "edit": edit}, self.taxonomy)["edit"], None)

    def test_restricted_and_out_of_scope_repairs(self):
        question = self.case("R015")
        restricted = {"verdict": "defect", "repair": "identical_options", "edit": None}
        self.assertEqual(assess_candidate(question, restricted, self.taxonomy)["route"], "faculty_review")
        out_of_scope = {"verdict": "defect", "repair": "spelling", "edit": {"field": "answer", "find": "B", "replace": "C"}}
        decision = assess_candidate(question, out_of_scope, self.taxonomy, independent_edit=out_of_scope["edit"])
        self.assertEqual((decision["route"], decision["edit"]), ("faculty_review", None))

    def test_non_unique_and_markup_edits_need_review(self):
        question = self.case("R001")
        for edit in (
            {"field": "question", "find": "the", "replace": "a"},
            {"field": "question", "find": "50 V", "replace": "<script>bad</script>"},
        ):
            candidate = {"verdict": "defect", "repair": "spelling", "edit": edit}
            self.assertEqual(assess_candidate(question, candidate, self.taxonomy, independent_edit=edit)["route"], "faculty_review")

    def test_word_only_spelling_can_pass_but_number_change_cannot(self):
        question = self.case("R012")
        edit = {"field": "question", "find": "Epithellial tisue", "replace": "Epithelial tissue"}
        candidate = {"verdict": "defect", "repair": "spelling", "edit": edit}
        self.assertEqual(assess_candidate(question, candidate, self.taxonomy, independent_edit=edit)["route"], "auto_apply")
        number_edit = {"field": "question", "find": "2019", "replace": "2020"}
        candidate["edit"] = number_edit
        self.assertEqual(assess_candidate(self.case("R013"), candidate, self.taxonomy, independent_edit=number_edit)["route"], "faculty_review")

    def test_bad_answer_labels_and_markup_in_list_are_not_automatic(self):
        scq = self.case("R001")
        edit = {"field": "answer", "find": "C", "replace": "Z"}
        self.assertEqual(assess_candidate(scq, {"verdict": "defect", "repair": "answer_key", "edit": edit}, self.taxonomy, independent_edit=edit)["route"], "faculty_review")
        mcq = self.case("R020")
        edit = {"field": "answer", "find": ["A, B, D"], "replace": ["<script>bad</script>"]}
        self.assertEqual(assess_candidate(mcq, {"verdict": "defect", "repair": "answer_key", "edit": edit}, self.taxonomy, independent_edit=edit)["route"], "faculty_review")
        integer = self.case("R005")
        edit = {"field": "answer", "find": "2", "replace": "two"}
        self.assertEqual(assess_candidate(integer, {"verdict": "defect", "repair": "answer_key", "edit": edit}, self.taxonomy, independent_edit=edit)["route"], "faculty_review")


if __name__ == "__main__":
    unittest.main()
