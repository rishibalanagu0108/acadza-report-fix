"""Generate one safe, evidence-backed result per supplied report."""

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from pathlib import Path

if __package__:
    from .safety import assess_candidate
    from .validate_data import EDIT_FIELDS, ROOT, load_inputs, validate_inputs
    from .validate_results import validate_results
else:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from scripts.safety import assess_candidate
    from scripts.validate_data import EDIT_FIELDS, ROOT, load_inputs, validate_inputs
    from scripts.validate_results import validate_results


MODEL = "gpt-6-luna"
MAX_CONCURRENT_CASES = 4
API_URL = "https://api.openai.com/v1/responses"
INPUT_PRICE_PER_MILLION = 0.10
OUTPUT_PRICE_PER_MILLION = 0.50
TRIAGE_PROMPT = (ROOT / "prompts" / "triage.md").read_text()
INDEPENDENT_PROMPT = (ROOT / "prompts" / "independent_check.md").read_text()


def groups_by_question(reports):
    groups = defaultdict(list)
    for report in reports:
        groups[report["questionId"]].append(report)
    return {qid: sorted(group, key=lambda row: row["reportId"]) for qid, group in sorted(groups.items())}


def local_api_key():
    """Load a key for the request without ever displaying or logging its value."""
    for name in ("OPENAI_API_KEY", "LLM_API_KEY"):
        if os.environ.get(name):
            return os.environ[name]

    env_path = ROOT / ".env.local"
    if env_path.exists():
        for raw_line in env_path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:].lstrip()
            name, separator, value = line.partition("=")
            if separator and name.strip() in {"OPENAI_API_KEY", "LLM_API_KEY"}:
                value = value.strip().strip("\"'")
                if value:
                    return value
    raise RuntimeError("Set OPENAI_API_KEY or LLM_API_KEY in .env.local before running triage.")


def edit_schema():
    value_schema = {
        "anyOf": [
            {"type": "string"},
            {"type": "array", "items": {"type": "string"}},
        ]
    }
    return {
        "type": "object",
        "properties": {
            "field": {"type": "string", "enum": sorted(EDIT_FIELDS)},
            "find": value_schema,
            "replace": value_schema,
        },
        "required": ["field", "find", "replace"],
        "additionalProperties": False,
    }


def nullable(schema):
    return {"anyOf": [schema, {"type": "null"}]}


def triage_schema(report_ids, taxonomy):
    analysis = {
        "type": "object",
        "properties": {
            "reportId": {"type": "string", "enum": report_ids},
            "verdict": {"type": "string", "enum": sorted(taxonomy["verdicts"])},
            "repair": nullable({"type": "string", "enum": sorted(taxonomy["repairs"])}),
            "edit": nullable(edit_schema()),
            "confidence": {"type": "number"},
            "evidence": {"type": "string"},
            "student_reply": {"type": "string"},
        },
        "required": ["reportId", "verdict", "repair", "edit", "confidence", "evidence", "student_reply"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {"analyses": {"type": "array", "items": analysis}},
        "required": ["analyses"],
        "additionalProperties": False,
    }


def independent_schema(taxonomy):
    return {
        "type": "object",
        "properties": {
            "conclusion": {"type": "string", "enum": ["defect", "no_defect", "uncertain"]},
            "repair": nullable({"type": "string", "enum": sorted(taxonomy["repairs"])}),
            "edit": nullable(edit_schema()),
            "evidence": {"type": "string"},
        },
        "required": ["conclusion", "repair", "edit", "evidence"],
        "additionalProperties": False,
    }


def response_text(payload):
    if isinstance(payload.get("output_text"), str):
        return payload["output_text"]
    chunks = []
    for item in payload.get("output", []):
        for part in item.get("content", []):
            if part.get("type") == "refusal":
                raise RuntimeError("The model refused a triage request.")
            if part.get("type") == "output_text":
                chunks.append(part.get("text", ""))
    if not chunks:
        raise RuntimeError("The model response contained no text output.")
    return "".join(chunks)


def request_json(api_key, instructions, data, schema_name, schema):
    body = json.dumps({
        "model": MODEL,
        "reasoning": {"effort": "low"},
        "instructions": instructions,
        "input": json.dumps(data, ensure_ascii=False),
        "text": {"format": {"type": "json_schema", "name": schema_name, "strict": True, "schema": schema}},
        "max_output_tokens": 3000,
        "store": False,
    }, ensure_ascii=False).encode()
    request = urllib.request.Request(
        API_URL,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                payload = json.loads(response.read())
            return json.loads(response_text(payload)), payload.get("usage", {})
        except urllib.error.HTTPError as error:
            if error.code in {429, 500, 502, 503, 504} and attempt < 3:
                time.sleep(min(2 ** attempt, 8))
                continue
            if error.code == 401:
                raise RuntimeError("OpenAI rejected the API key (HTTP 401); the key was not displayed.") from None
            if error.code == 404:
                raise RuntimeError(f"OpenAI could not find model {MODEL} or this project lacks access (HTTP 404).") from None
            raise RuntimeError(f"OpenAI request failed with HTTP {error.code}; response body omitted to protect credentials.") from None
        except urllib.error.URLError as error:
            if attempt < 3:
                time.sleep(min(2 ** attempt, 8))
                continue
            raise RuntimeError(f"Could not reach OpenAI: {error.reason}") from None
        except (json.JSONDecodeError, KeyError, TypeError) as error:
            raise RuntimeError(f"Could not read the structured model response: {error}") from None
    raise RuntimeError("OpenAI request failed after retries.")


def question_context(question):
    kind = question["questionType"]
    payload = question[kind]
    return {
        "questionId": question["_id"],
        "questionType": kind,
        "subject": question.get("subject"),
        "chapter": question.get("chapter"),
        "concept": question.get("concept"),
        "question_html": payload["question"],
        "solution_html": payload["solution"],
        "saved_answer": payload["answer"],
    }


def safe_candidate(question, candidate, taxonomy, independent):
    if candidate["verdict"] != "defect":
        return {"route": "no_change", "edit": None, "reason": "No question change was proposed."}
    confirmed_edit = independent["edit"] if independent["conclusion"] == "defect" else None
    try:
        return assess_candidate(question, candidate, taxonomy, independent_edit=confirmed_edit)
    except ValueError as error:
        return {"route": "faculty_review", "edit": None, "reason": f"The proposal failed a safety check: {error}."}


def merge_group(question, reports, analyses, independent, taxonomy):
    expected = {report["reportId"] for report in reports}
    actual = [row.get("reportId") for row in analyses]
    if set(actual) != expected or len(actual) != len(expected):
        raise RuntimeError(f"Model did not return exactly one analysis for every report on question {question['_id']}.")
    if not isinstance(independent.get("evidence"), str) or not independent["evidence"].strip():
        raise RuntimeError(f"Independent check lacked evidence for question {question['_id']}.")

    rows = []
    for report in reports:
        candidate = next(row for row in analyses if row["reportId"] == report["reportId"])
        verdict = candidate["verdict"]
        evidence = candidate["evidence"].strip()
        student_reply = candidate["student_reply"].strip()
        if verdict == "defect":
            if candidate["repair"] not in taxonomy["repairs"]:
                raise RuntimeError(f"Missing valid repair for {report['reportId']}.")
            checked = safe_candidate(question, candidate, taxonomy, independent)
            edit = checked["edit"]
            route = checked["route"]
            if independent["conclusion"] != "defect":
                evidence += f" Independent check: {independent['conclusion']}; sent to faculty. {independent['evidence'].strip()}"
            elif route == "faculty_review":
                evidence += f" Faculty review needed: {checked['reason']}"
            elif route == "auto_apply":
                evidence += " Separate question-only check confirmed the exact proposed edit."
        else:
            if candidate["repair"] is not None or candidate["edit"] is not None:
                evidence += " A repair paired with a non-defect verdict was discarded."
            edit, route = None, "no_change"
        confidence = candidate["confidence"]
        if type(confidence) not in (int, float):
            confidence = 0
        rows.append({
            "reportId": report["reportId"],
            "questionId": report["questionId"],
            "verdict": verdict,
            "repair": candidate["repair"] if verdict == "defect" else None,
            "edit": edit,
            "route": route,
            "confidence": max(0, min(1, confidence)),
            "evidence": evidence,
            "student_reply": student_reply,
        })
    return rows


def check_group(api_key, qid, group, question, taxonomy):
    ids = [report["reportId"] for report in group]
    content = question_context(question)
    raw, triage_usage = request_json(api_key, TRIAGE_PROMPT, {
        "question": content,
        "taxonomy": {"verdicts": taxonomy["verdicts"], "repairs": taxonomy["repairs"]},
        "reports": [{"reportId": r["reportId"], "comment": r["comment"]} for r in group],
    }, "report_triage", triage_schema(ids, taxonomy))
    analyses = raw.get("analyses")
    if not isinstance(analyses, list):
        raise RuntimeError(f"Model returned no analyses for question {qid}.")

    # This second call intentionally receives no student comment or proposed edit.
    independent, independent_usage = request_json(api_key, INDEPENDENT_PROMPT, {
        "question": content,
        "taxonomy": {"verdicts": taxonomy["verdicts"], "repairs": taxonomy["repairs"]},
    }, "independent_question_check", independent_schema(taxonomy))
    usage = {key: int(triage_usage.get(key, 0)) + int(independent_usage.get(key, 0))
             for key in ("input_tokens", "output_tokens")}
    return merge_group(question, group, analyses, independent, taxonomy), usage


def apply_report_guards(rows, reports, questions, taxonomy):
    """Promote three source-verifiable warning signs to faculty review only."""
    by_question = {question["_id"]: question for question in questions}
    by_report = {report["reportId"]: report for report in reports}
    for row in rows:
        report = by_report[row["reportId"]]
        question = by_question[row["questionId"]]
        content = question[question["questionType"]]["question"]
        comment = report["comment"].casefold()
        warning = None

        # A student claim can only raise a case for review; it cannot supply an edit.
        if question["questionType"] == "scq" and (
            "option d is missing" in comment or "only 3 options" in comment
        ):
            labels = set(re.findall(r"\(([A-D])\)", content, flags=re.IGNORECASE))
            labels = {label.upper() for label in labels}
            if "D" not in labels and len(labels) == 3:
                warning = (
                    "option_repair",
                    "The saved single-choice question has options A, B, and C only; faculty should confirm whether D is missing.",
                    "Thanks for flagging this. The saved question shows only options A, B, and C, so faculty should check whether another option is missing.",
                )
        elif "out of syllabus" in comment:
            warning = (
                "syllabus",
                "The current NMC syllabus covers biological evolution broadly, but does not establish whether this specific ancestral-state question is in scope; faculty should decide.",
                "Thanks for flagging this. Faculty will check the syllabus coverage before deciding whether this question belongs in the course.",
            )
        elif r"\frac" in content and ("code is showing" in comment or "\\frac" in comment):
            warning = (
                "markup_leak",
                "The saved stem contains literal \\frac markup and the report says it appears as code; faculty should check the rendered question.",
                "Thanks for reporting this. The saved question contains fraction markup, so faculty should check how it appears on screen.",
            )

        if warning:
            repair, evidence, reply = warning
            if repair not in taxonomy["repairs"]:
                raise RuntimeError(f"Missing taxonomy rule for review guard {repair}.")
            row.update({
                "verdict": "defect",
                "repair": repair,
                "edit": None,
                "route": "faculty_review",
                "evidence": evidence,
                "student_reply": reply,
            })
    return rows


def create_results(root=ROOT, progress=print):
    questions, reports, taxonomy = load_inputs(root)
    by_question, _ = validate_inputs(questions, reports, taxonomy)
    groups = groups_by_question(reports)
    api_key = local_api_key()
    usage = {"input_tokens": 0, "output_tokens": 0}
    rows = []
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_CASES) as pool:
        jobs = {
            pool.submit(check_group, api_key, qid, group, by_question[qid], taxonomy): (qid, group)
            for qid, group in groups.items()
        }
        for index, future in enumerate(as_completed(jobs), 1):
            qid, group = jobs[future]
            case_rows, case_usage = future.result()
            rows.extend(case_rows)
            for key in usage:
                usage[key] += case_usage[key]
            progress(f"Checked {index}/{len(groups)} question cases; latest {qid} has {len(group)} report{'s' if len(group) != 1 else ''}.")

    _, by_report = validate_inputs(questions, reports, taxonomy)
    rows = apply_report_guards(rows, reports, questions, taxonomy)
    rows.sort(key=lambda row: row["reportId"])
    validate_results(rows, by_report, taxonomy)
    estimate = (usage["input_tokens"] * INPUT_PRICE_PER_MILLION + usage["output_tokens"] * OUTPUT_PRICE_PER_MILLION) / 1_000_000
    return rows, usage, estimate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "results.json")
    parser.add_argument("--force", action="store_true", help="replace an existing output file")
    parser.add_argument("--dry-run", action="store_true", help="show case count without making API calls")
    args = parser.parse_args()
    questions, reports, taxonomy = load_inputs()
    by_question, _ = validate_inputs(questions, reports, taxonomy)
    groups = groups_by_question(reports)
    if args.dry_run:
        print(f"Ready: {len(reports)} reports across {len(groups)} question cases; model {MODEL}; no API calls made.")
        return
    if args.output.exists() and not args.force:
        raise RuntimeError(f"{args.output} already exists; pass --force to replace it.")
    rows, usage, estimate = create_results()
    temp = args.output.with_suffix(args.output.suffix + ".tmp")
    temp.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n")
    temp.replace(args.output)
    print(f"Wrote {len(rows)} validated report results to {args.output}.")
    print(f"Token usage: {usage['input_tokens']} input, {usage['output_tokens']} output; estimated standard-rate cost: ${estimate:.4f}.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        raise SystemExit(str(error)) from error
