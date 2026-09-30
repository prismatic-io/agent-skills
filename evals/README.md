# Skill evaluations

Lux owns execution, persona answers, grading, traces, and comparisons. The
installable skill contains instructions and bundled references; eval code is
development tooling.

## Setup and run

Prerequisites: repository mise tools; authenticated Claude Code (`claude`), Codex
(`codex`), Grok Build (`grok`), and Antigravity (`agy`) for suites that select it;
and a built incur-based Prism checkout at `../../prism` (relative to this directory).
`PRISM_ROOT` can select another Prism checkout. Lux is pinned to the published
`0.0.2-preview.28` package in both development manifests and lockfiles.
No local Lux checkout is required. Installable skills have no Lux dependency.

The pinned Node.js 22.18.0 runs TypeScript directly; helpers need no build step.
npm 11 is pinned separately to avoid npm 10 dependency-install failures.

Prism must already be authenticated to the intended Prismatic sandbox using your
usual development setup. The subject and publication check inherit that setup.

From the repository root:

```sh
mise run eval:doctor    # install dependencies, check Prism schema, typecheck cases
mise run eval:run       # run 13 component cases across Claude Code, Codex, and Grok Build
mise run eval:cni       # run 12 CNI cases across the same profiles
mise run eval:embedded  # run 4 embedded-app cases, including Antigravity
```

`eval:prepare` places a launcher for the chosen Prism build on the subject's PATH.
The noninteractive launcher filters bearer credentials and JWTs from Prism output;
it does not sanitize arbitrary secrets or other executables.
Verify the effective `prism --version` inside each agent: its shell environment
can still select the old globally installed CLI despite this PATH prefix. Dependency
versions are locked; keep the Prism revision and installed agent CLI versions
constant when comparing results. Record them with review notes.
The case preamble names the cached Prism executable and requires its version
check before other commands; subjects must not replace it with an `npx` download.

For other Lux operations, run from `evals/` through the environment-filtering wrapper:

```sh
node run-components.ts --list
node run-components.ts new-petstore --verbose
npm run lux -- run --tag components --profile codex
npm run lux -- run files-com --loop 3
npm run lux -- view
npm run lux -- compare <before-suite> <after-suite>
PRISM_READ_ONLY=true node run-lux.ts run workato-contact --profile codex
```

The runners allowlist inherited environment variables and isolate zsh startup files.
Use native CLI authentication; provider API-key environment variables are not forwarded.
Use `run-lux.ts` for direct Lux commands to retain this boundary. It is not a filesystem sandbox.

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
scores. Execution failures, failed non-rubric checks, and incomplete grading still
produce a nonzero exit. The report distinguishes incomplete grading from a
demonstrated execution or check failure; abstention does not turn unassessed
behavior into a skill defect. Direct Lux commands retain Lux's original exit behavior.

## Local Code Native Integration evaluations

Run `mise run eval:cni` from the repository root, or `node run-integrations.ts
--list` from `evals/` for discovery without model calls. The runner selects the
`integration-skill` cases and the same Claude Code, Codex, and Grok Build profile
matrix as components, retaining per-profile artifacts and qualitative reports.
The CNI suite contains **six net-new and six existing-project requests**; case
source, shared rubrics, verification helpers, and their tests live together in
`cases/prismatic-build-integration/`. Business-specific criteria stay in each case;
underscore-prefixed helpers are excluded from Lux case discovery. The component suite has the
same 6/6 expansion plus its original Files.com case (13 total).
The prior seven-case CNI baseline does not establish results for the five added
requests; report expanded runtime results only after running and reviewing them.

These requests authorize local implementation only: no import, deployment,
publication, platform tests, or service mutations. Both the CNI and migration runners set
`PRISM_READ_ONLY=true` on Lux and its inherited environment as defense in depth;
it is not a security sandbox and cannot prevent arbitrary direct HTTP calls or
a subject overriding its environment. Review execution traces for scope.
Component runs retain their existing publication behavior. These are restrictions
of the local eval cases, not of the installed skills, which support authorized
platform verification. Direct `run-lux.ts` invocations bypass the matrix defaults: set
`PRISM_READ_ONLY=true` explicitly when running local CNI or migration cases.
These suites do not establish quality of the autonomous platform verification loop.

`cases/prismatic-build-integration/_verify-generated-cni.mjs` accepts a root or nested Spectral project, rejects
ambiguous projects, requires a build script, and runs every available
typecheck/lint/test/build script. Each
child check has a two-minute bound and POSIX timeout cleanup includes its process
group. The checker does not install packages; dependency installation is subject
work. After a successful build, it loads the entry selected by the installed
Prism 11 importer: project-root `index.js` when present, otherwise
`dist/index.js`. It checks for a default CNI definition with
`codeNativeIntegrationYAML` and catches SDK registration errors in a bounded
Node subprocess. `package.json` `main` does not select Prism's CNI entry;
other package layouts are outside this local diagnostic's supported contract.
Run generated scripts in disposable copies/environments. Passing scripts and an
entry load establish local readiness only, not correct flow behavior, complete
configuration, or meaningful tests. A no-op build without a Prism entry fails
the local entry diagnostic. Inspect actual
registered integration/flow artifacts and representative mocked execution
independently, and grade behavior, validation, and usability separately.
No live credentials are required for mocked verification.

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
The migration runner also includes Antigravity; other runners keep it
available through explicit profile selection:

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
with `PRISM_READ_ONLY=true node run-lux.ts run --tag integration-skill`.

Lux preview.28 supplies native Claude Code, Codex, Antigravity, and Grok Build
drivers. `component-agents.ts` configures the additional profiles;
`run-components.ts` runs the component-tagged cases once per profile. Direct
`node run-lux.ts run` defaults to Codex; use `--profile` to select another subject.
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

Antigravity uses private sandbox settings. To reuse native authentication, set
`ANTIGRAVITY_REUSE_KEYCHAIN=1` or `ANTIGRAVITY_AUTH_TOKEN_FILE`.
For Prism catalog access, `PRISM_REUSE_PROFILE=1` stages only the selected profile
in a private temporary directory, leaving the original config untouched.
Keep `PRISM_READ_ONLY=true` for local-only evaluations.

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
and `mode: "accept-edits"` (also the Lux preview.28 driver default).
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
   mutable paths limited to the skill, graded quality comparisons, and objectives
   that balance workflow quality with instruction size and agent usage. Run `experiment --plan` first.
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

## Migration evaluations

Run the 21 vendor-export and bespoke-code cases sequentially across Claude Code,
Codex, Antigravity, and Grok Build with `mise run eval:migrations -- --concurrency 1`. The runner produces the same continuous quality
reports as the component and CNI suites; deterministic build checks remain separate.
They authorize local ports and assessments, not deployment or live mutations.
Python 3.11+ and system IANA timezone data are required for source checks.
The pinned Lux preview includes the migration capture and grading fixes.
Migration cases use the shared Lux configuration. The migration runner selects the profiles above; direct Lux commands select one with `--profile`. No container runtime or special Prism build is required.
Fresh artifact workspaces are not a security sandbox; subjects can access host
tools and authentication, as in the other suites.

After `mise run eval:prepare`, run one case from `evals/`:

```sh
PRISM_READ_ONLY=true node run-lux.ts run prismatic-migrate-integration/bespoke-order-sync --verbose
```

`PRISM_MIGRATION_SKILL=migration` is the default; `build` selects the integration
building skill and `none` omits explicit skill loading. These are development
cases, not held-out tests or automatic activation checks.

Buildable ports get independent build and registration checks. Source tests
characterize supplied fixtures; rubric scores and generated tests do not prove
full behavioral equivalence. Accept useful milestones with honest limits and
normal human corrections. Optional `evals/cases/prismatic-migrate-integration/_verify-*.mjs` checkers require
reviewer-approved interface adapters and isolated execution against local services;
unsupported interfaces need review. Registration-evidence helpers produce manual
review attachments, not automatic grading evidence. Inspect checker tests for
supported adapters and scenarios. Assessment cases do not demand invented code
when the source contract is incomplete.

## Embedded app evaluations

Run `mise run eval:embedded` from the repository root, or `node run-embedded.ts
--list` from `evals/`. The runner selects the `embedded-skill` cases and these
profiles: Claude Code, Codex, Antigravity, and Grok Build. All cases edit `fixtures/embedded/acme-portal`, an Express 5 and
React app with cookie sessions and two tenants. `marketplace-settings` asks for
the marketplace in Settings; `browser-signing-request` asks to sign tokens in the
browser, which the skill should decline in favor of a small backend endpoint;
`create-signing-key` also asks the agent to create the organization's signing
key with Prism; `match-app-theme` asks for embedded screens that match the
app's colors, font, and dark mode.
The 2026-09-30 pass also exercised backend-only, key-rotation, and native
skill-discovery requests. Codex and Grok passed the app checks; Antigravity app
runs stopped on native permission denials. Claude continued under isolated
controls after an out-of-workspace cleanup attempt. Separate dependency-restored
checks passed for its app implementations, while key handling failed. Preserve
original grades and scope findings; this does not establish uniform portability.
Native selection was confirmed for Codex, Antigravity, and Grok; isolated Claude
completed its discovery request without loading the staged skill.

The embedded runner uses `embedded/lux.config.ts`: Claude runs with native
isolation and stream-json interaction, with edits confined to sandboxed Bash.
Native Edit/Write tools are excluded because they bypass that filesystem sandbox.
Direct root Lux commands use the shared profiles; use the embedded runner for
these controls.

All suites use the real Prism build selected by `PRISM_ROOT` through the shared
credential-redacting launcher prepared by `eval:prepare`. No commands are
simulated. Embedded requests forbid Prismatic API calls, sign-in, and
signing-key changes except the one key and read-only organization identity
lookup authorized by `create-signing-key`. Run that case against an authenticated,
disposable sandbox organization: each run can register a real public key and
leave a private-key file outside the project. The operator is responsible for
removing the sandbox key and local private-key file after reviewing the handoff.
The embedded runner does not force `PRISM_READ_ONLY`; a caller-supplied read-only
policy is respected and will prevent key creation. CNI and migration runners
retain their read-only policy. Antigravity authentication still uses the shared
`PRISM_REUSE_PROFILE=1` opt-in to stage the selected real Prism profile. Claude's
native write sandbox remains in effect: credential refresh needs a writable
Prism config directory, and its default `TMPDIR` is inside the project, so it
is unsuitable for the outside-project signing-key handoff. Permission failures
are harness limitations to report, not reasons to substitute simulated success.

`cases/prismatic-embedded/_verify-embedded-app.mjs` restores dependencies
and runs the app's available typecheck/lint/test/build scripts in a disposable
copy. It checks that `@prismatic-io/embedded` is a dependency and ships in the built client, that
no private key is committed outside tests, and that browser code neither signs
tokens nor reads a `VITE_` signing key. Finally it generates an RSA key pair,
starts the fixture's `createApp()` with that key and a test organization ID,
signs in as each fixture user, and calls the case's token path. The token must
verify as RS256 and carry the session's user and tenant, the configured
organization, and a valid `iat`/`exp`. Spoofed identity in the query, body, or
headers must not change the claims, and unauthenticated requests must get no
token. For `create-signing-key`, the `key-handoff` and `local-scope` rubrics
assess actual command results and messages for creation, file placement, secret
handling, and handoff. There is no synthetic command log or automatic key-file
cleanup. Local checks establish the application contract; transcript rubrics
provide the key-workflow evidence and must abstain when truncation prevents a
supported judgment. Key creation and handoff are quality scores, not a hard
acceptance gate; passing local checks alone does not prove key creation. The
historical results from both dates used simulated signing-key commands and do
not validate the real signing-key workflow.

Claude Code results on 2026-09-29 (`claude-sonnet-5`, medium effort, Lux
preview.27, linked Prism 11 from `next` behind the stand-in, one run per case
on the current skill; judges use `claude-opus-5-5`):

| Case | Local checks | Case score | Lowest rubric |
| --- | --- | --- | --- |
| `marketplace-settings` | passed | 0.89 | token-design 0.78 |
| `browser-signing-request` | passed | 0.88 | handoff 0.68 |
| `create-signing-key` | passed | 0.84 | key-handoff 0.60 |
| `match-app-theme` | passed | 0.87 | handoff 0.68 |

One run per case does not establish variance: a second `match-app-theme` run
differed by omitting the Google font. A later run started the app with plain
Node and failed on a CommonJS named import that Vitest had accepted, so the
skill now asks agents to start the backend the way the app runs it. Handoffs
and refresh-timer cleanup remain the weakest areas.
