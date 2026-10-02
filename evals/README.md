# Skill evaluations

Lux runs cases in `cases/<skill>/` and retains native grades, traces, and artifacts
in `.lux-runs/`. Use a built Prism checkout at `../prism` or set `PRISM_ROOT`.
Authenticate Claude Code. Evals use your existing Prism session and may publish
components and integrations or create signing keys. A native Lux suite hook checks
the Prism session before starting any case and requires an HTTPS `prismatic-dev.io`
endpoint, including when you invoke Lux directly. Authentication and endpoint
provisioning belong to the harness; case prompts request outcomes without telling
the agent to reuse a session or verify the development hostname.
The default subject uses `claude-sonnet-5` with medium reasoning effort; the
rubric judge and stakeholder persona use `claude-opus-5-5` with medium effort.
Use `--profile codex` to switch the subject, judge, and persona together to
Codex Sol with low effort. Lux registers the supplied skills with each driver’s
native discovery while keeping model and permission configuration in the harness.

The Prism checkout must include the native command-routing, agent permission-hint,
diagnostic-redaction changes, and `integrations validate`. `LUX_PACKAGE` can
override the installed Lux package with a built `.tgz` when testing unreleased
Lux changes.

```sh
mise run eval:prepare
mise run eval:run -- --help
mise run eval:run -- prismatic-integrations --list
mise run eval:run -- prismatic-integrations
mise run eval:run -- prismatic-integrations/edit-order-mapping
mise run eval:run -- prismatic-migrate --loop 3
mise run eval:run -- prismatic-components
mise run eval:run -- prismatic-components --profile codex
mise run eval:check
```

There is no read-only eval profile. Platform work follows the selected request:
implementation cases publish to the existing development organization; assessment
cases can remain assessments. External services are mocked when their credentials
are unavailable. `create-signing-key` creates a real key; load it into your secret
manager and remove the private-key file after review. Account signup remains
manual; `orby/signup-guidance` checks that boundary, while
`orby/setup-existing-org` starts after signup. Read the selected case before
running it. `--skip-judge` runs only deterministic assertions. Inspect saved results
with native `lux view` or `compare`.

Offline `eval:check` verifies types and oracle unit tests; it does not establish
that an agent workflow passes. Every quality rubric uses continuous, proportional
0–1 scoring. Acceptance thresholds label results separately and never round or cap a quality score.
Platform publication and scope receive partial credit for demonstrated outcomes.
Optional test-quality and presentation measurements are
explicitly informational: their scores affect quality summaries, but carry no
pass verdict and do not satisfy acceptance gates. Inspect scores, comments, and
abstentions alongside deterministic checks before calling a skill successful.
Native case scores average assertion scores, including deterministic build and
completion checks; individual rubric scores show the quality of each outcome.
Pass rate measures acceptance, not incremental progress.

Native `lux grade` can reassess a saved trace without rerunning the subject. It
creates a new grading record. Checks requiring dependencies abstain when their
execution workspace is unavailable; saved evidence does not prove a changed skill.

Lux owns driver environment configuration and stakeholder answers; Prism owns
CLI permissions and diagnostic safety. The evals contain
requests, fixtures, and contract assertions. Keep model, CLI, tool and fixture
revisions fixed for comparisons. Explicit loading tests workflow quality;
discovery requires separate cases. Inspect actual behavior and independent checks;
a build or judge score alone does not prove correctness. Preserve raw results and
report incomplete evidence and provider, permission, or grader failures honestly.
