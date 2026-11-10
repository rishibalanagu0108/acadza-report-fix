"""Check the required local submission files and scored results."""

import json
import re
from pathlib import Path

from validate_data import load_inputs, require, validate_inputs
from validate_results import validate_results


ROOT = Path(__file__).resolve().parents[1]
LIVE_URL = "https://acadza-report-fix-brown.vercel.app/"
REQUIRED_FILES = (
    "README.md",
    "PRODUCT.md",
    "PROMPTS.md",
    "results.json",
    "data/questions.json",
    "data/reports.json",
    "data/taxonomy.json",
    "prompts/triage.md",
    "prompts/independent_check.md",
)


def copied_prompt(document, heading, source):
    section = document.split(heading, 1)[1]
    match = re.search(r"```text\n(.*?)\n```", section, re.DOTALL)
    return bool(match) and match.group(1) + "\n" == source


def main():
    for filename in REQUIRED_FILES:
        require((ROOT / filename).is_file(), f"required file is missing: {filename}")

    product = (ROOT / "PRODUCT.md").read_text()
    product_words = len(re.findall(r"\b[\w’'-]+\b", product))
    require(product_words <= 500, f"PRODUCT.md is too long ({product_words} words; limit is 500)")
    require("```mermaid" in product, "PRODUCT.md needs its flow diagram")

    prompts = (ROOT / "PROMPTS.md").read_text()
    require("```mermaid" in prompts, "PROMPTS.md needs its flow diagram")
    require(
        copied_prompt(
            prompts,
            "### Prompt 1: report triage",
            (ROOT / "prompts/triage.md").read_text(),
        ),
        "Prompt 1 in PROMPTS.md must exactly match prompts/triage.md",
    )
    require(
        copied_prompt(
            prompts,
            "### Prompt 2: question-only check",
            (ROOT / "prompts/independent_check.md").read_text(),
        ),
        "Prompt 2 in PROMPTS.md must exactly match prompts/independent_check.md",
    )
    mistakes = prompts.split("## Mistakes we caught", 1)
    require(len(mistakes) == 2, "PROMPTS.md needs a mistakes section")
    mistake_rows = re.findall(r"^\d+\.\s", mistakes[1], re.MULTILINE)
    require(len(mistake_rows) >= 3, "PROMPTS.md must describe at least three AI mistakes")

    readme = (ROOT / "README.md").read_text()
    require(LIVE_URL in readme, "README.md must include the live demo URL")
    require("faculty_review_decisions" in readme or "decision and its history" in readme,
            "README.md must describe saved faculty decisions")
    for obsolete in ("read-only faculty queue", "planned for Milestone 5", "reserved for the final submission milestone"):
        require(obsolete not in readme, f"README.md contains outdated information: {obsolete}")

    questions, reports, taxonomy = load_inputs(ROOT)
    _, by_report = validate_inputs(questions, reports, taxonomy)
    require(len(by_report) == 44, f"expected 44 supplied reports, found {len(by_report)}")
    results = json.loads((ROOT / "results.json").read_text())
    validate_results(results, by_report, taxonomy)

    print(f"Submission checks passed: {len(results)} reports and all required files are present.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(str(error)) from error
