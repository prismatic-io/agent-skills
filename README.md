<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" alt="Prismatic" />
  <h1>Prismatic Agent Skills</h1>
</div>

Reusable skills for AI agents working with [Prismatic](https://prismatic.io/), covering platform operations, custom connectors, code-native integrations, migrations, and embedded experiences. Each skill is independently installable and uses the [Agent Skills format](https://agentskills.io/specification).

[![skills.sh](https://skills.sh/b/prismatic-io/agent-skills)](https://skills.sh/prismatic-io/agent-skills)

## Available skills

| Skill | Purpose |
| --- | --- |
| [orby](skills/orby/SKILL.md) | Explore, operate, and troubleshoot Prismatic environments, and coordinate end-to-end platform outcomes. |
| [prismatic-components](skills/prismatic-components/SKILL.md) | Build and update custom connectors for Prismatic low-code integrations. |
| [prismatic-integrations](skills/prismatic-integrations/SKILL.md) | Build and update Prismatic Code Native Integrations, then verify them through local checks and authorized platform execution. |
| [prismatic-migrate](skills/prismatic-migrate/SKILL.md) | Port vendor workflows or bespoke integration code to Prismatic using source evidence and behavioral verification. |
| [prismatic-embedded](skills/prismatic-embedded/SKILL.md) | Embed Prismatic's marketplace and other screens in a web app, with backend-signed embedded-user tokens and the embedded SDK. |

## Installation

With Node.js and npm installed, choose skills and your agent interactively:

```sh
npx skills add prismatic-io/agent-skills
```

Run `npx skills update` to update installed skills.
See the [skills CLI](https://github.com/vercel-labs/skills) for installation options.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development, evaluations, and releases.

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

## Who uses Prismatic?

Prismatic is built for B2B software companies that need to provide integrations to their customers. Whether you're a growing SaaS startup or an established enterprise, Prismatic's platform scales with your integration needs.

Our platform is particularly powerful for teams serving specialized vertical markets. We provide the flexibility and tools to build exactly the integrations your customers need, regardless of the systems you're connecting to or how unique your integration requirements may be.

## What kind of integrations can you build using Prismatic?

Prismatic supports integrations of any complexity - from simple data syncs to sophisticated, industry-specific solutions. Teams use it to build integrations between any type of system, whether modern SaaS or legacy with standard or custom protocols. Here are some example use cases:

- Connect your product with customers' ERPs, CRMs, and other business systems
- Process data from multiple sources with customer-specific transformation requirements
- Automate workflows with customizable triggers, actions, and schedules
- Handle complex authentication flows and data mapping scenarios

For information on the Prismatic platform, check out our [website](https://prismatic.io/) and [docs](https://prismatic.io/docs/).

## License

This repository is MIT licensed.
