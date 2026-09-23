# Contributing

Install tools and run checks with mise:

```sh
mise install
mise run check
```

Use `mise tasks` to list available tasks and `mise run format` to apply formatting.
See [AGENTS.md](AGENTS.md) for skill authoring guidance.

The evals require an authenticated Claude Code CLI, local Lux, and the locally
linked Prism 11 build. The component evals also require Prism authentication to
an intended Prismatic sandbox because they publish a test component.

```sh
claude auth status
mise run eval:run
```
