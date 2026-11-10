"""Check the scored results.json contract against the supplied reports."""

import json
import math
import sys
from pathlib import Path

if __package__:
    from .validate_data import EDIT_FIELDS, load_inputs, require, validate_inputs
else:
    from validate_data import EDIT_FIELDS, load_inputs, require, validate_inputs


REQUIRED = {"reportId", "questionId", "verdict", "repair", "edit", "route", "confidence", "evidence", "student_reply"}
ROUTES = {"auto_apply", "faculty_review", "no_change"}


def validate_results(rows, by_report, taxonomy):
    require(isinstance(rows, list), "results must be a list")
    require(len(rows) == len(by_report), f"expected {len(by_report)} result rows, found {len(rows)}")
    seen = set()
    for index, row in enumerate(rows):
        require(isinstance(row, dict), f"result {index} must be an object")
        require(set(row) == REQUIRED, f"result {index} must contain exactly {sorted(REQUIRED)}")
        rid = row["reportId"]
        require(isinstance(rid, str) and rid in by_report and rid not in seen, f"result {index} has an unknown or duplicate reportId")
        seen.add(rid)
        require(row["questionId"] == by_report[rid]["questionId"], f"result {rid} has the wrong questionId")
        verdict = row["verdict"]
        require(isinstance(verdict, str) and verdict in taxonomy["verdicts"], f"result {rid} has an unknown verdict")
        repair = row["repair"]
        edit = row["edit"]
        route = row["route"]
        require(isinstance(route, str) and route in ROUTES, f"result {rid} has an unknown route")
        if verdict == "defect":
            require(isinstance(repair, str) and repair in taxonomy["repairs"], f"defect {rid} needs a known repair")
            require(route != "no_change", f"defect {rid} cannot have no_change route")
        else:
            require(repair is None and edit is None and route == "no_change", f"non-defect {rid} must not propose a question edit")
        if edit is not None:
            require(isinstance(edit, dict) and set(edit) == {"field", "find", "replace"}, f"result {rid} has an invalid edit shape")
            require(isinstance(edit["field"], str) and edit["field"] in EDIT_FIELDS, f"result {rid} has an unknown edit field")
            for value in (edit["find"], edit["replace"]):
                require(isinstance(value, str) or (isinstance(value, list) and all(isinstance(x, str) for x in value)), f"result {rid} has an invalid edit value")
        require(route != "auto_apply" or edit is not None, f"auto_apply result {rid} needs an edit")
        confidence = row["confidence"]
        require(type(confidence) in (int, float) and math.isfinite(confidence) and 0 <= confidence <= 1, f"result {rid} has invalid confidence")
        for field in ("evidence", "student_reply"):
            require(isinstance(row[field], str) and row[field].strip(), f"result {rid} needs non-empty {field}")
    require(seen == set(by_report), "results do not cover every report")


def main(path):
    questions, reports, taxonomy = load_inputs()
    _, by_report = validate_inputs(questions, reports, taxonomy)
    rows = json.loads(Path(path).read_text())
    validate_results(rows, by_report, taxonomy)
    print(f"Valid results: {len(rows)} reports")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: python3 scripts/validate_results.py results.json")
    try:
        main(sys.argv[1])
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(str(error)) from error
