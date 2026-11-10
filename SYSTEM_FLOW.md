# Acadza Report → Fix architecture

This diagram shows the **parts of the system and how information moves between them**, like the architecture example you shared. Read it from the student report at the top through triage, the scored output, and the teacher's review website.

```mermaid
flowchart TB
    Student([Student taps Report error]) --> Reports[(Student reports)]

    subgraph Input[Supplied Acadza data]
        Reports
        Questions[(Questions, answers, solutions)]
        Taxonomy[(Verdict and repair rules)]
    end

    subgraph Triage[Question checker - batch run]
        Group[Group reports by question]
        Context[Build full question context]
        Model[AI suggests verdict, edit, and reply]
        Verify[Independent answer and content check]
        Guard[Safety gate: evidence, allowed fields, exact edit]
        Route{Choose route}
        NoChange[No question change]
        Auto[Automatic route eligible]
        Faculty[Faculty review required]
    end

    Reports --> Group --> Context
    Questions --> Context
    Context --> Model --> Guard
    Context --> Verify
    Verify -. checks the suggestion .-> Guard
    Taxonomy --> Guard
    Guard --> Route
    Route -- correct or non-content issue --> NoChange
    Route -- proven and permitted edit --> Auto
    Route -- uncertain or restricted edit --> Faculty

    NoChange --> Results[(results.json: 44 report decisions)]
    Auto --> Results
    Faculty --> Results

    subgraph Review[Faculty review website]
        Queue[Queue grouped by question]
        Case[Original question, reports, evidence, before/after, reply]
        Action[Approve, edit, or reject]
        API[Recheck and save the teacher decision]
        Audit[(Decision and audit history)]
        Queue --> Case --> Action --> API --> Audit
        Audit -. current status .-> Case
    end

    Results --> Queue
    Questions --> Case
    Reports --> Case

    classDef actor fill:#eaf5ee,stroke:#4e8d68,color:#153b27,stroke-width:2px;
    classDef process fill:#e8f1fc,stroke:#5b84b2,color:#183454,stroke-width:1px;
    classDef decision fill:#fff2d6,stroke:#b88126,color:#523506,stroke-width:2px;
    classDef data fill:#f4efff,stroke:#8970ae,color:#382652,stroke-width:1px;
    class Student actor;
    class Group,Context,Model,Verify,Guard,NoChange,Auto,Faculty,Queue,Case,Action,API process;
    class Route decision;
    class Reports,Questions,Taxonomy,Results,Audit data;
```

**What each part does:** The checker looks at the report and the original question. The independent check and safety gate challenge its suggestion. The route tells us whether to leave the question alone, mark a safe correction as eligible, or ask faculty. `results.json` stores one decision per report. The website presents those decisions by question, and faculty actions go into the audit history.

**Important boundary:** The batch run produces proposed decisions. It does not change Acadza's live question bank. A student's comment is input data, never an instruction to the checker.

See [MILESTONES.md](MILESTONES.md) for when we build each part and [PROBLEM_ANALYSIS.md](PROBLEM_ANALYSIS.md) for examples from the supplied reports.
