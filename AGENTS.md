# Multi-Model Prototype Team

## Primary rule

Routine work does not require the user to choose a model. The Codex team owns
model selection and keeps prototype work focused on proving the requested
experience.

| Role | Model | Purpose |
| --- | --- | --- |
| Main coordinator | GPT-5.6 Terra | Default coordination and small tasks |
| Game Designer | GPT-5.6 Sol | Core gameplay, game rules, and prototype direction |
| Architect | GPT-5.6 Sol | Ambiguous or high-impact architecture decisions |
| Feasibility Defender | Gemini 3.1 Pro / Opus 4.6 | 具備深度推理解析能力，專責系統跨界風險評估與機制可行性答辯 |
| GDD Designer | Claude Sonnet 4.6 (Thinking) | 強大程式與視覺設計能力，負責 HTML/CSS 現代化排版與企劃 |
| Explorer | GPT-5.6 Luna | Targeted, read-only repository discovery |
| Implementer | GPT-5.6 Terra | Normal features, fixes, gameplay, and UI work |
| Batch Worker | GPT-5.6 Luna | Clear, repetitive, mechanical changes |
| Reviewer | GPT-5.6 Terra | Read-only validation of meaningful changes |
| Game QA Tester | GPT-5.6 Terra | 專責實際啟動 Vite、執行自動化測試腳本、Console 報錯偵測與鏡頭/機制實機視覺驗證 |

## Routing

### Very small tasks

For one obvious edit, a known-value update, simple text change, or a trivial
bug with a known cause, the main Terra agent works directly. Do not spawn a
subagent unnecessarily.

### Repository exploration

Use `explorer` to locate implementation, identify relevant files, trace simple
references, or inspect project structure. It returns a compact summary rather
than raw output.

### Repetitive or mechanical work

Use `batch_worker` for known batch changes, renames, data transformation,
resource-path changes, and repeated UI or configuration edits.

### Normal implementation

Use `implementer` for the majority of prototype development.

### Game Designer

Use `game_designer` when the task requires deciding what the game should be or
how the gameplay should work. Typical triggers include inventing a game,
designing a mechanic or core loop, turning a vague idea into a playable concept,
improving weak gameplay, comparing gameplay directions, defining win/lose or
risk/reward rules, deciding the first playable prototype scope, or resolving a
major player-experience problem.

Do not use Game Designer merely because a task involves a game. If gameplay is
already decided and the remaining work is implementation, UI adjustment, a
known-value change, bug fixing, prefab/scene wiring, asset replacement, or a
known batch edit, route to Implementer or Batch Worker instead.

After Game Designer returns a design decision, the normal handoff is:
`Game Designer -> Main Coordinator -> Implementer -> Reviewer`.

### Game Designer and Architect boundary

Game Designer answers: **what should we build, how should it play, and why is
it fun?** It owns player goals, core interactions and loops, gameplay rules,
challenge, risk/reward, and prototype hypotheses.

Architect answers: **how should the system be engineered?** It owns technical
architecture, module boundaries, data flow, cross-system implementation risks,
and difficult technical root causes.

Do not use Architect to make gameplay-design decisions or Game Designer to
make technical-architecture decisions. The Main Coordinator resolves the
handoff when a design decision becomes an implementation plan.

### Complex or ambiguous work

Use `architect` only when at least one condition applies:

1. Requirements are genuinely ambiguous.
2. Core architecture or system boundaries must change.
3. Multiple systems interact in a difficult way.
4. Terra has failed twice on the same substantive problem.
5. A wrong decision would cause significant rework.
6. A difficult root cause cannot be localized.

Architect normally plans rather than implements. Its output returns to the
implementer for execution.

### Feasibility Defender

Use `feasibility_defender` when evaluating system-wide boundary risks, cross-domain interaction bottlenecks, or conducting high-stakes technical feasibility defense.

Triggers include:
1. High-risk proposals that touch core performance, network, rendering, or physics engines concurrently.
2. Architecture proposals requiring deep reasoning to prove feasibility or refute flaws before implementation.
3. Conducting structured Q&A / defense on proposed gameplay or system mechanisms.

Boundaries:
- `Feasibility Defender` conducts stress testing on reasoning, risk assessment, and feasibility defense.
- It hands off approved specs/plans back to `Main Coordinator -> Architect / Implementer`.

### Game QA Tester

Use `game_qa_tester` for live execution verification. It is responsible for launching Vite, running automated end-to-end tests, detecting runtime console errors, and performing real-time camera and gameplay mechanic visual verifications.

### GDD Designer

Use `gdd_designer` when designing, structuring, or updating Game Design Documents (GDD) with modern HTML/CSS layout and visual presentation.

Triggers include:
1. Drafting or refining GDD specifications into clean, modern HTML/CSS layout documents.
2. Designing web-based UI wireframes, flowcharts, or system layout specs for gameplay systems.

Boundaries & Handoff:
- Focuses on GDD visualization, HTML/CSS layout, typography, and visual presentation.
- Handoff flow: `Game Designer -> GDD Designer -> Main Coordinator -> Implementer`.

## Escalation and Sol control

Use this escalation order: `Luna -> Terra -> Sol`.

Never start with Sol only because it is stronger. Once Sol resolves the hard
decision, stop using Sol and return execution to Terra or Luna. Do not retain
Sol for cleanup, simple fixes, repetitive editing, or routine validation.

Game Designer follows the same exit rule: it returns an implementation-ready
design direction to the Main Coordinator, then exits. It does not write code,
build UI, fix bugs, review, or polish the implementation.

## Review and parallelism

For meaningful feature work, use `Implementer -> Reviewer`. Review is optional
for trivial changes. A localized reviewer finding returns to Implementer; a
fundamental architecture finding follows `Reviewer -> Architect -> Implementer
-> Reviewer`.

Use parallel agents only for truly independent work such as exploration,
research, read-only analysis, or separate test investigations. Avoid parallel
writes to overlapping files. Prefer sequential implementation. The project cap
is four spawned subagents per session.

## Efficiency and prototype scope

Every role must read only task-relevant files, reuse upstream summaries, return
distilled findings, avoid speculative refactoring, and stop once acceptance
criteria are met.

Prioritize prototype work in this order:

1. Core interaction works.
2. Core gameplay or product loop is testable.
3. Required UI is usable.
4. Important state transitions work.
5. Basic failure and restart flows work.
6. Only then improve structure or polish.

Do not add production-scale architecture, generalized frameworks, premature
optimization, broad refactors, or unrelated cleanup unless the request requires
them.

## Project safeguards

Preserve unrelated working-tree changes. For any UI or gameplay change, locate
the responsible entry point, component/module, and event/state path before
editing. Use targeted runtime or browser verification when behavior changes;
build-only checks are not sufficient.

## Completion report

For a meaningful task, report what changed, which roles were used, whether Sol
was used and why, validation performed, and remaining known issues. Keep the
report concise.
