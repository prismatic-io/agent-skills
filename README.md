<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" alt="Prismatic" />
  <h1>Prismatic Agent Skills</h1>
</div>

Reusable skills for AI agents working with [Prismatic](https://prismatic.io/).
This repository is organized as a collection of independently installable skills
using the [Agent Skills format](https://agentskills.io/specification) and
[Vercel's skills CLI](https://github.com/vercel-labs/skills).

[![skills.sh](https://skills.sh/b/prismatic-io/agent-skills)](https://skills.sh/prismatic-io/agent-skills)

## Available skills

| Skill | Purpose |
| --- | --- |
| [prismatic-components](skills/prismatic-components/SKILL.md) | Build and update custom connectors for Prismatic low-code integrations. Initial scaffold; evaluated with Lux. |
| [prismatic-build-integration](skills/prismatic-build-integration/SKILL.md) | Build and update Prismatic Code Native Integrations, then verify them through local checks and authorized platform execution. |
| [prismatic-migrate-integration](skills/prismatic-migrate-integration/SKILL.md) | Port vendor workflows or bespoke integration code to Prismatic using source evidence and behavioral verification. |

## Installation

Once skills are published, use Node.js and npm to browse and install them:

```sh
# Preview the available skills.
npx skills add prismatic-io/agent-skills --list

# Choose skills and agents interactively.
npx skills add prismatic-io/agent-skills

# Install the whole collection for a chosen agent.
npx skills add prismatic-io/agent-skills --skill '*' --agent claude-code
```

For one skill, replace `SKILL_NAME` with a name from the catalog:

```sh
npx skills add prismatic-io/agent-skills --skill SKILL_NAME
```

Installation is project-scoped by default; add `--global` for your user account.
The CLI supports multiple agents; select yours with `--agent` or the interactive
prompt. Read each skill's prerequisites before use.

Update installed skills with:

```sh
npx skills update
```

## Development

Skills live in `skills/<skill-name>/SKILL.md`. Each folder contains its own
instructions and any supporting scripts, references, or assets.
See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and checks, and
[AGENTS.md](AGENTS.md) for authoring guidance.
See [evals/README.md](evals/README.md) for the Lux workflow and current coverage.
`mise run eval:cni` evaluates local CNI creation and edits across the three subject
profiles without authorizing deployment or live-service mutations; local checks
and qualitative workflow assessments are reported separately.

## Releases

Skills are distributed directly from GitHub. Default-branch changes are available
to new installs; existing users run `npx skills update`. No npm publish is required.
Optional repository-wide tags and GitHub Releases can mark milestones.

Before publishing, run `mise run release:check` and `mise run skills:list`.
The release check requires a nonempty catalog.

[skills.sh listing](https://skills.sh/docs/faq) follows installation telemetry.
Use [skills.sh.json](https://skills.sh/docs/customize) to group published skills;
[packs](https://skills.sh/docs/packs) optionally bundle skills across repositories.

## What is Prismatic?

Prismatic is the leading embedded iPaaS, enabling B2B SaaS teams to ship product integrations faster and with less dev time. The only embedded iPaaS that empowers both developers and non-developers with tools for the complete integration lifecycle, Prismatic includes low-code and code-native building options, deployment and management tooling, and self-serve customer tools.

Prismatic's unparalleled versatility lets teams deliver any integration from simple to complex in one powerful platform. SaaS companies worldwide, from startups to Fortune 500s, trust Prismatic to help connect their products to the other products their customers use.

With Prismatic, you can:

- Build [integrations](https://prismatic.io/docs/integrations/) using our [intuitive low-code designer](https://prismatic.io/docs/integrations/low-code-integration-designer/) or [code-native](https://prismatic.io/docs/integrations/code-native/) approach in your preferred IDE
- Leverage pre-built [connectors](https://prismatic.io/docs/components/) for common integration tasks, or develop custom connectors using our TypeScript SDK
- Embed a native [integration marketplace](https://prismatic.io/docs/embed/) in your product for customer self-service
- Configure and deploy customer-specific integration instances with powerful configuration tools
- Support customers efficiently with comprehensive [logging, monitoring, and alerting](https://prismatic.io/docs/monitor-instances/)
- Run integrations in a secure, scalable infrastructure designed for B2B SaaS
- Customize the platform to fit your product, industry, and development workflows


For more information, visit our [website](https://prismatic.io/) and [documentation](https://prismatic.io/docs/).

## License

[MIT](LICENSE), consistent with Prism.
