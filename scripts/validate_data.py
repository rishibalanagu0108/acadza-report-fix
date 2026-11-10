"""Validate the supplied Acadza snapshot before triage."""

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
QUESTION_TYPES = {"scq", "mcq", "integerQuestion"}
EDIT_FIELDS = {"question", "solution", "answer", "questionType"}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def load_inputs(root=ROOT):
    data = Path(root) / "data"
    return tuple(json.loads((data / f"{name}.json").read_text()) for name in ("questions", "reports", "taxonomy"))


def validate_inputs(questions, reports, taxonomy):
    require(isinstance(questions, list) and questions, "questions must be a non-empty list")
    require(isinstance(reports, list) and reports, "reports must be a non-empty list")
    require(isinstance(taxonomy, dict), "taxonomy must be an object")
    verdicts = taxonomy.get("verdicts")
    repairs = taxonomy.get("repairs")
    require(isinstance(verdicts, dict) and verdicts, "taxonomy.verdicts must be an object")
    require(isinstance(repairs, dict) and repairs, "taxonomy.repairs must be an object")
    for key, rule in repairs.items():
        require(isinstance(key, str) and key, "repair keys must be non-empty strings")
        require(isinstance(rule, dict), f"repair {key} must be an object")
        fields = rule.get("fields")
        require(isinstance(fields, list) and all(isinstance(field, str) and field in EDIT_FIELDS for field in fields), f"repair {key} has invalid fields")
        require(isinstance(rule.get("auto"), bool), f"repair {key} needs a boolean auto flag")

    by_question = {}
    for index, question in enumerate(questions):
        require(isinstance(question, dict), f"question {index} must be an object")
        qid = question.get("_id")
        require(isinstance(qid, str) and qid and qid not in by_question, f"question {index} has a missing or duplicate _id")
        kind = question.get("questionType")
        require(isinstance(kind, str) and kind in QUESTION_TYPES, f"question {qid} has an unknown questionType")
        payload = question.get(kind)
        require(isinstance(payload, dict), f"question {qid} lacks its {kind} payload")
        require(isinstance(payload.get("question"), str), f"question {qid} lacks question HTML")
        require(isinstance(payload.get("solution"), str), f"question {qid} lacks solution HTML")
        answer = payload.get("answer")
        require(isinstance(answer, str) or (isinstance(answer, list) and all(isinstance(x, str) for x in answer)), f"question {qid} has an invalid answer shape")
        by_question[qid] = question

    by_report = {}
    for index, report in enumerate(reports):
        require(isinstance(report, dict), f"report {index} must be an object")
        rid = report.get("reportId")
        require(isinstance(rid, str) and rid and rid not in by_report, f"report {index} has a missing or duplicate reportId")
        require(isinstance(report.get("questionId"), str) and report["questionId"] in by_question, f"report {rid} refers to an unknown question")
        for field in ("studentId", "source", "reportedAt", "comment"):
            require(isinstance(report.get(field), str), f"report {rid} lacks string {field}")
        by_report[rid] = report
    return by_question, by_report


if __name__ == "__main__":
    try:
        questions, reports, taxonomy = load_inputs()
        by_question, by_report = validate_inputs(questions, reports, taxonomy)
        print(f"Valid input: {len(by_question)} questions, {len(by_report)} reports, {len(taxonomy['repairs'])} repairs")
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(str(error)) from error
