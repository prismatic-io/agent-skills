# Skill evaluations

Lux runs cases in `cases/<skill>/` and retains native grades, traces, and artifacts
in `.lux-runs/`. Use a built Prism checkout at `../prism` or set `PRISM_ROOT`.
Authenticate Claude Code and Prism against a disposable Prismatic sandbox.
The default subject uses `claude-sonnet-5` with medium reasoning effort; the
rubric judge and stakeholder persona use `claude-opus-5-5` with medium effort.
Codex remains available through the `codex` and `codex-sandbox` profiles.

The native fixes are currently on development branches. Until Lux releases them,
set `LUX_PACKAGE` to its built `.tgz`; preparation installs that package without
changing the manifest or lockfile. The Prism checkout must include the native
read-only scaffold and optional editor-hint fixes.

```sh
mise run eval:prepare
mise run eval:run -- --help
mise run eval:run -- prismatic-integrations --list
mise run eval:run -- prismatic-integrations
mise run eval:run -- prismatic-integrations/edit-order-mapping
mise run eval:run -- prismatic-migrate --loop 3
mise run eval:run -- prismatic-components --profile claude-code-sandbox
mise run eval:check
```

The default Claude Code profile keeps Prism read-only. `claude-code-sandbox` permits the
platform writes requested by component cases and embedded `create-signing-key`.
That case creates a real signing key; remove the sandbox key and private-key file
after review. Read the selected case before running it. `--skip-judge` runs only
deterministic assertions. Inspect saved results with native `lux view` or `compare`.

Offline `eval:check` verifies types and oracle unit tests; it does not establish
that an agent workflow passes. Quality rubrics report continuous scores without
acceptance gates: inspect scores, comments, and abstentions alongside deterministic
check results before calling a skill successful.

Native `lux grade` can reassess a saved trace without rerunning the subject. It
creates a new grading record. Checks requiring dependencies abstain when their
execution workspace is unavailable; saved evidence does not prove a changed skill.

Lux owns host environment filtering, credential isolation, and stakeholder
answers; Prism owns CLI permissions and diagnostic safety. The evals contain
requests, fixtures, and contract assertions. Keep model, CLI, tool and fixture
revisions fixed for comparisons. Explicit loading tests workflow quality;
discovery requires separate cases. Inspect actual behavior and independent checks;
a build or judge score alone does not prove correctness. Preserve raw results and
report incomplete evidence and provider, permission, or grader failures honestly.
