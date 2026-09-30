# Contributing

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
