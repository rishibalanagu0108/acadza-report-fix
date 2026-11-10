"""Deterministic gate between model proposals and question edits.

``independent_edit`` must come from a check that does not follow the student's
comment or copy the model proposal. Without that second check, no edit is
eligible for automatic routing.
"""

import re

from scripts.validate_data import EDIT_FIELDS, require


def assess_candidate(question, candidate, taxonomy, independent_edit=None):
    """Return a safe route, displayable edit, and reason without changing input."""
    require(isinstance(candidate, dict), "candidate must be an object")
    verdict = candidate.get("verdict")
    require(isinstance(verdict, str) and verdict in taxonomy["verdicts"], "unknown verdict")
    if verdict != "defect":
        return {"route": "no_change", "edit": None, "reason": "No question defect was established."}

    repair = candidate.get("repair")
    require(isinstance(repair, str) and repair in taxonomy["repairs"], "unknown repair")
    rule = taxonomy["repairs"][repair]
    edit = candidate.get("edit")
    if not rule["fields"]:
        return {"route": "faculty_review", "edit": None, "reason": "This repair requires faculty authorship."}
    if not isinstance(edit, dict) or set(edit) != {"field", "find", "replace"}:
        return {"route": "faculty_review", "edit": None, "reason": "No valid exact edit was proposed."}
    field = edit["field"]
    if not isinstance(field, str) or field not in EDIT_FIELDS or field not in rule["fields"]:
        return {"route": "faculty_review", "edit": None, "reason": "The repair cannot change this field."}

    kind = question["questionType"]
    original = kind if field == "questionType" else question[kind][field]
    find, replace = edit["find"], edit["replace"]
    text_values = []
    for value in (find, replace):
        if isinstance(value, str):
            text_values.append(value)
        elif isinstance(value, list) and all(isinstance(x, str) for x in value):
            text_values.extend(value)
        else:
            return {"route": "faculty_review", "edit": None, "reason": "Edit values must be text."}
    if field in {"answer", "questionType"}:
        exact = find == original and type(find) is type(original) and type(replace) is type(original)
    else:
        exact = isinstance(find, str) and isinstance(replace, str) and bool(find) and original.count(find) == 1
    if not exact or find == replace:
        return {"route": "faculty_review", "edit": None, "reason": "The edit is not an exact, unique change to the saved field."}
    if field == "questionType" or any("<" in value or ">" in value for value in text_values):
        return {"route": "faculty_review", "edit": edit, "reason": "Structural or markup changes need faculty review."}
    # ponytail: long text replacements go to faculty; raise this cap only after a real safe case needs it.
    if field in {"question", "solution"} and max(len(find), len(replace)) > 160:
        return {"route": "faculty_review", "edit": edit, "reason": "Large text changes need faculty review."}
    if field == "answer" and (kind == "mcq" or (kind == "scq" and replace not in {"A", "B", "C", "D"})):
        return {"route": "faculty_review", "edit": edit, "reason": "Answer shape or option needs faculty review."}
    if field == "answer" and kind == "integerQuestion" and not re.fullmatch(r"[+-]?\d+", replace):
        return {"route": "faculty_review", "edit": edit, "reason": "Integer answer needs faculty review."}
    if repair == "spelling" and any(not re.fullmatch(r"[A-Za-z ]+", value) for value in text_values):
        return {"route": "faculty_review", "edit": edit, "reason": "Spelling repair must change words only."}
    if not rule["auto"]:
        return {"route": "faculty_review", "edit": edit, "reason": "Taxonomy requires faculty approval."}
    if independent_edit != edit:
        return {"route": "faculty_review", "edit": edit, "reason": "An independent check has not confirmed this exact edit."}
    return {"route": "auto_apply", "edit": edit, "reason": "Exact allowed edit confirmed by an independent check."}
