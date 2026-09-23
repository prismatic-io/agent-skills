# Component evaluations

Lux owns execution, persona answers, grading, traces, and comparisons. The
installable skill contains only `SKILL.md`; eval code is development tooling.

## Setup and run

Prerequisites: repository mise tools, an authenticated Claude Code CLI, a built
Lux checkout at `../../lux/packages/lux`, and a built incur-based Prism checkout
at `../../prism` (paths relative to this directory). Follow each checkout's build
instructions. `PRISM_ROOT` can select another Prism checkout. Lux is a local file
dependency while its distribution is being finalized; installable skills have no
Lux dependency.

The pinned Node.js 22.18.0 runs TypeScript directly; helpers need no build step.

Prism must already be authenticated to the intended Prismatic sandbox using your
usual development setup. The subject and publication check inherit that setup.

From the repository root:

```sh
mise run eval:doctor  # install dependencies, check Prism schema, typecheck cases
mise run eval:run     # model calls and sandbox publication
```

`eval:prepare` places a symlink to the chosen Prism build on the subject's PATH.
This avoids accidentally evaluating the old globally installed CLI. Dependency
versions are locked, but local Lux and Prism source revisions must also be held
constant when comparing results. Keep their revision IDs with review notes.

For other Lux operations, run from `evals/`:

```sh
node node_modules/@prismatic-io/lux/lib/cli/bin.js run --list
node node_modules/@prismatic-io/lux/lib/cli/bin.js run files-com --loop 3
node node_modules/@prismatic-io/lux/lib/cli/bin.js view
node node_modules/@prismatic-io/lux/lib/cli/bin.js compare <before-suite> <after-suite>
```

Runs are retained in ignored `.lux-runs/`. Inspect the run, trace, grading, and
component artifacts before changing instructions. Run packages and test scripts
are agent-generated code; use a disposable development environment.

## First case: Files.com

The case in `cases/files-com.ts` holds the inaugural user prompt verbatim.
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

`check-component.ts` discovers the generated package and reruns its checks.
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

The case binds the skill with `subjectPath()`, keeping it usable with immutable
Lux experiment candidates. The short harness preamble explicitly loads the skill:
this measures output quality, **not automatic activation**. Automatic discovery,
existing-component edits, and no-skill baselines remain additional eval cases.
`PRISM_EVAL_FIXTURE=/absolute/path` can seed a continuation from an existing
component. Point it at the package root, not a directory containing that package. Such runs are tagged `continuation`, not `train`; report them separately
from fresh-workspace runs.

## Harness limits

Claude Code is the only configured subject. Models and effort are explicit in
`lux.config.ts`; persona answering uses a smaller model than implementation and
judging. Future Codex, Cursor, Antigravity, GitHub Copilot, and frontend copilot
profiles should reuse the business prompt and outcome assertions. Add adapter
configuration only once the relevant Lux driver supports the required interaction
and artifact capture; configuration placeholders would not establish compatibility.

Claude's `defer-resume` mode handles simulated answers. Current Lux rejects using
it with `isolation`. These runs use fresh artifact workspaces, disable user setting
sources and auto-memory, and inherit Prism's existing authentication.
That is not a filesystem or network sandbox. It also does not establish freedom
from all host-state contamination. Use a disposable host/container for stronger
isolation; do not switch to the legacy interaction protocol to hide the limitation.

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
