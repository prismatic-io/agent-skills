# Contributing

Skills live in `skills/<skill-name>/SKILL.md`. Each folder contains its own
instructions and any supporting scripts, references, or assets.

Install tools and run checks with mise:

```sh
mise install
mise run check
```

Use `mise tasks` to list available tasks and `mise run format` to apply formatting.
See [AGENTS.md](AGENTS.md) for skill authoring guidance.

See [evals/README.md](evals/README.md) for evaluation prerequisites.
Use `mise run eval:check` for offline eval checks and
`mise run eval:run -- --help` for native case filters and profiles.

Run a specific skill with `mise run eval:run -- prismatic-integrations`;
use a canonical case ID for tighter iteration and native Lux profiles for comparisons.

## Releases

Skills are distributed directly from GitHub. Default-branch changes are available
to new installs; existing users run `npx skills update`. No npm publish is required.
Optional repository-wide tags and GitHub Releases can mark milestones.

Before publishing, run `mise run release:check` and `mise run skills:list`.
The release check requires a nonempty catalog.

[skills.sh listing](https://skills.sh/docs/faq) follows installation telemetry.
Use [skills.sh.json](https://skills.sh/docs/customize) to group published skills;
[packs](https://skills.sh/docs/packs) optionally bundle skills across repositories.
