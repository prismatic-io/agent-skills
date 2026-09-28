# Component evaluations

Lux owns execution, persona answers, grading, traces, and comparisons. The
installable skill contains instructions and bundled references; eval code is
development tooling.

## Setup and run

Prerequisites: repository mise tools; authenticated Claude Code (`claude`), Codex
(`codex`), and Grok Build (`grok`) CLIs; and a built
incur-based Prism checkout at `../../prism` (relative to this directory).
`PRISM_ROOT` can select another Prism checkout. Lux is pinned to the published
`0.0.2-preview.26` npm package in both development manifests and lockfiles;
a local Lux checkout is no longer required. Installable skills have no Lux dependency.

The pinned Node.js 22.18.0 runs TypeScript directly; helpers need no build step.

Prism must already be authenticated to the intended Prismatic sandbox using your
usual development setup. The subject and publication check inherit that setup.

From the repository root:

```sh
mise run eval:doctor  # install dependencies, check Prism schema, typecheck cases
mise run eval:run     # run all 13 cases against Claude Code, Codex, and Grok Build
```

`eval:prepare` places a symlink to the chosen Prism build on the subject's PATH.
Verify the effective `prism --version` inside each agent: its shell environment
can still select the old globally installed CLI despite this PATH prefix. Dependency
versions are locked; keep the Prism revision and installed agent CLI versions
constant when comparing results. Record them with review notes.
The case preamble names the cached Prism executable and requires its version
check before other commands; subjects must not replace it with an `npx` download.

For other Lux operations, run from `evals/`:

```sh
node run-components.ts --list
node run-components.ts new-petstore --verbose
npm run lux -- run --tag components --profile codex
npm run lux -- run files-com --loop 3
npm run lux -- view
npm run lux -- compare <before-suite> <after-suite>
```

Runs are retained in ignored `.lux-runs/`. Inspect the run, trace, grading, and
component artifacts before changing instructions. Run packages and test scripts
are agent-generated code; use a disposable development environment.

Track behavior, validation,
and usability separately. Missing a specific test is an improvement opportunity,
not a binary rejection of working behavior. From `evals/`, inspect saved scores:

```sh
node quality-report.ts <run-directory-or-grading.json>
node quality-report.ts <before-run> <after-run> --json
```

This report summarizes saved rubric scores; it does not rerun or independently
regrade a solution. Older pass/fail-oriented judge scores need evidence review
before comparison with the new qualitative scale. Preserve raw grades, record
reassessments separately, and compare matched cases. Execution and build outcomes
remain visible separately from quality; no weighted overall pass/fail is implied.

`run-components.ts` prints per-case ratings, feedback, and dimension distributions
from each invocation's own suite manifest. Runs are isolated under
`.lux-runs/quality-runs/eval-run-*/<profile>/`; use `--runs-root <directory>` to
choose another parent directory. Missing or unfinished cases remain visible.
The wrapper treats legacy rubric thresholds as diagnostic: a completed suite with
only rubric threshold failures can exit successfully while reporting its quality
scores. Execution failures, failed non-rubric checks, and grading errors still
produce a nonzero exit. Direct Lux commands retain Lux's original exit behavior.

## First case: Files.com

The case in `cases/prismatic-components/files-com.ts` holds the inaugural user prompt verbatim.
The persona is a low-code integration builder who knows the business outcome but
cannot supply API design decisions. It can clarify file-change timing and partner
file encryption. It has no Files.com credentials. Success includes publication to
the authenticated Prismatic sandbox and a handoff for using the connector.

Success means:

- A Spectral component with the requested file operations and file-change trigger.
- Build, typecheck, and tests pass; tests exercise generated behavior.
- A private component with a fresh `files-com-lux-*` key is published in the
  authenticated sandbox, and Prism reports the new version as available.
- Service operations and trigger semantics are grounded in official documentation.
- The agent makes technical choices without an upfront questionnaire and explains
  configuration in terms a low-code builder understands.

`cases/prismatic-components/_check-component.ts` discovers the generated package and reruns its checks. Edit cases in that skill directory export their own feature check; the generic checker receives `--case` with the authored case path and imports that check. Underscore-prefixed helpers stay out of Lux case discovery.
Rubrics inspect implementation, tests, and interaction where command exit codes
cannot establish correctness. A passing build alone cannot prove API correctness.
The `sandbox-publication` assertion inspects the recorded `prism components publish`
call. Prism waits for the new version to become available before it reports
success, so a successful result is publication evidence. For an independent check
after a run, execute `prism components signature --format json` in the generated
package; an empty signature means the local package differs from the published
package. Published eval components remain for review; the suite does not delete or
overwrite unrelated components.
Files.com API calls are mocked; live file operations are not verified.

Each case binds its skill with `subjectPath()`, keeping it usable with immutable
Lux experiment candidates. The short harness preamble explicitly loads the skill:
this measures output quality, **not automatic activation**. Automatic discovery,
existing-component edits, and no-skill baselines remain additional eval cases.
`PRISM_EVAL_FIXTURE=/absolute/path` can seed a continuation from an existing
component. Point it at the package root, not a directory containing that package. Such runs are tagged `continuation`, not `train`; report them separately
from fresh-workspace runs.

## Harness limits

The component runner executes Claude Code, Codex, and Grok Build sequentially.
Antigravity remains available through explicit profile selection:

| Profile | Model | Effort | Interaction |
| --- | --- | --- | --- |
| `claude-code` | `claude-sonnet-5` | medium | Existing defer/resume persona answers |
| `codex` | `gpt-6-sol` | low | App-server persona answers |
| `antigravity` | `gemini-3.1-pro` | low | Headless, no persona follow-up |
| `grok-build` | `grok-4.6` | low | ACP with per-operation permission answers |

Gemini Pro at low effort is the chosen comparison setting, not a claim of equal
compute or capability. Persona answering and all rubric judging use Claude Code
`claude-opus-5-5` at medium effort for every subject. Prompts, fixtures, and assertions
are shared. Integration cases also default to Codex and can be run
with `lux run --tag integration-skill` using the CLI path above.

Lux preview.26 supplies native Claude Code, Codex, Antigravity, and Grok Build
drivers. `component-agents.ts` configures the additional profiles;
`run-components.ts` runs the component-tagged cases once per profile. Direct
`lux run` defaults to Codex; use `--profile` to select another subject.
All profiles use `idleTimeout: "20 minutes"` for inactivity. Claude deferred
invocations also use `turnTimeout: "45 minutes"` to cap elapsed time; progress
events stream live.
Grok uses native ACP instead of the former local headless adapter. Auto-mode
permission requests reach Lux's answerer, and approvals apply to one operation
only. The driver retains tool/message evidence and rejects incomplete turns or
pending permission requests at completion. Grok usage/cost reporting remains
unavailable; do not interpret it as zero cost.
Protocol references: [Antigravity headless mode](https://antigravity.google/docs/cli/headless/)
and [Grok headless mode](https://docs.x.ai/build/cli/headless-scripting).

Run `agy` interactively to sign in, and `grok login` for Grok. `agy models` and
`grok models` check available models. `eval:doctor` checks config, tests, executable
availability, and Claude/Codex authentication; it cannot prove every provider's account
has model access. A real smoke run is still needed on the authenticated host.

These runs use fresh artifact workspaces and inherit Prism's sandbox authentication.
Claude uses `permissionMode: "auto"` with no extra coding-tool grants, while
keeping disabled user setting sources and auto-memory. Codex uses app-server
`approvalPolicy: "on-request"` with `approvalsReviewer: "auto_review"`,
workspace-write sandboxing, and network access. Grok uses `permissionMode: "auto"`, `sandbox: "workspace"`, and
`trustProject: false`.
Antigravity has no native auto reviewer in this release and uses normal permissions
with `skipPermissions: false`. No profile uses a CLI permission-bypass flag. Native allow rules still control
automatic tool approval. A headless
permission wait or denial can prevent completion and must be recorded as a harness
limitation, not silently retried with broader permissions.

On Antigravity 1.2.10–1.2.11, this host uses `enableTerminalSandbox: true`
and `toolPermission: "proceed-in-sandbox"`; the profile sets `sandbox: true`
and `mode: "accept-edits"` (also the Lux preview.26 driver default).
Explicit editing mode fixes the observed sandbox workspace-write failures.
There are no `command(...)` allow rules: these versions use them to authorize
outside-sandbox execution too. They ignore `unsandboxed(...)` rules, so those
rules cannot enforce a sandbox boundary. `skipPermissions` remains false.
Scoped file/web grants supply workspace, skill, runtime, and documentation access.
A shell canary test verified that reads and writes outside the granted workspace
were denied, while workspace builds and tests succeeded.

The full sandbox-only component case remains blocked by the local HTTP fixture:
direct loopback connections fail with EPERM; the sandbox proxy rejects literal IP
addresses and nonstandard HTTP ports, even with localhost explicitly allowed.
Node 24.21.0 with `NODE_USE_ENV_PROXY=1` reaches the proxy but does not remove
that restriction. The repository Node pin remains 22.18.0. Do not restore host
command grants or weaken assertions to hide this failure. Another host needs
its own permission setup and verification.

The cases request publication of a fresh sandbox component. These workspaces are
not full host isolation: agent CLIs may read user settings and history, and
Antigravity cannot handle persona follow-up questions. Grok ACP supports permission
answers; this does not establish support for every conversational question tool. Report those limits
when comparing agents. Keep detailed baseline traces and notes under the ignored
`.lux-runs/` tree, and separate original outcomes from any infrastructure reruns.

## Curation loop

1. Run a case, inspect its artifacts and questions, and distinguish subject failures
   from harness failures (startup, permissions, missing evidence, judge errors).
2. Make the smallest instruction change supported by the failure. Prefer a Prism
   improvement when it belongs in the CLI. Keep service-specific facts in cases.
3. Repeat against the same models and tool revisions. Use Lux comparisons and
   review the underlying evidence, not only the aggregate score.
4. Add an existing-component request and a held-out service before claiming broad
   workflow quality. Add installation/activation and no-skill baseline cases.
5. Once train/validation/test cases are disjoint, author a Lux experiment with
   mutable paths limited to the skill, quality regression gates, and objectives
   that minimize subject bytes and agent usage. Run `experiment --plan` first.
   Do not optimize and promote against this single training prompt.

## Design references

The [Agent Skills specification](https://agentskills.io/specification) permits a
single self-contained skill file. Its [authoring guidance](https://agentskills.io/skill-creation/best-practices)
favors task-specific knowledge, moderate detail, and refinement through execution;
its [evaluation guidance](https://agentskills.io/skill-creation/evaluating-skills)
calls for real prompts, artifact evidence, and baseline comparisons.

We reviewed the old component skill, builder flow, and eval conventions in
`../../prismatic-skills`. Its questionnaire phases, separate entrypoints,
plugin-root references, helper wrappers, and forced internal architecture are not
carried forward. Prism's current command help and templates own scaffolding.
[Prismatic connector docs](https://prismatic.io/docs/custom-connectors/) and
[production components](https://github.com/prismatic-io/components/tree/main/components)
remain the SDK references instead of copied manuals.

For Files.com grading, consult the current [developer docs](https://developers.files.com/),
[file webhooks](https://www.files.com/docs/automation-and-flow/notifications/webhooks),
and [ad hoc GPG operations](https://www.files.com/docs/encryption/gpg-pgp/ad-hoc-gpg-encrypt-decrypt).
These are grader research pointers, not answers supplied to the persona.
