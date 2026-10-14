# Working on skills

Use [mise.toml](mise.toml) for development tasks and [CONTRIBUTING.md](CONTRIBUTING.md#releases)
for release guidance.

- Follow the [Agent Skills specification](https://agentskills.io/specification).
- Prefer stable `prismatic-` names. Describe both the capability and when to use it.
- Keep instructions focused. Bundle references, assets, and Node-compatible
  helpers inside the skill so it works when installed alone. Document prerequisites.
- Include any required helper build output in the installable skill folder;
  consumers do not get this repository's development environment.
- Update the README catalog when adding a skill.
- Test changed skills with realistic agent requests in a disposable project,
  including their bundled helpers. Static checks do not establish workflow quality.

## Portable authoring and evidence

- State outcomes, constraints, and non-obvious reasons; preserve user scope and
  valid alternatives. Fix observed failure classes, not individual eval answers.
- Use skill-relative resources and conditional references. Keep model selection,
  effort, permissions, and host-specific tools in harness configuration.
- Derive verification from authoritative contracts independently of generated
  code: tests can repeat the implementation's mistaken assumptions.
- Test discovery separately from explicit loading. Compare revisions in fresh
  workspaces with fixed models, harnesses, tools, and assertions; include passing
  regressions and independent transfer tasks. Retain traces and uncertainty.
- Use adversarial subagent review for substantive revisions to challenge vendor
  assumptions, scope expansion, and eval leakage. Fix demonstrably wrong
  assertions; distinguish grader/harness failures from skill failures.
- Claim portability only across tested models and harnesses. File-format
  compatibility or success with one model/harness pair does not establish it.

## Vendor guidance and differences

Checked 2026-09-24; recheck changing behavior. Model advice is not harness policy:

| Model or harness | Guidance to preserve |
| --- | --- |
| [Anthropic skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | Test sufficient detail for Haiku, clarity/efficiency for Sonnet, and unnecessary explanation for Opus; validate the actual model versions. |
| [Claude Code](https://code.claude.com/docs/en/skills) | `allowed-tools` pre-approves tools for the invoking turn; it does not restrict the tool set. |
| [OpenAI Codex](https://developers.openai.com/codex/skills) | Descriptions drive implicit selection; optional `agents/openai.yaml` configuration is host-specific. |
| [Google Gemini CLI](https://geminicli.com/docs/cli/skills-best-practices/) / [Antigravity](https://www.antigravity.google/docs/skills/) | Use focused procedures and discoverable helpers; Antigravity CLI/IDE skill locations differ. |
| [Gemini 3 models](https://ai.google.dev/gemini-api/docs/gemini-3#prompting-best-practices) | Prefer direct, concise instructions over elaborate prompting inherited from older models. |
| [xAI Grok Build](https://docs.x.ai/build/features/skills-plugins-marketplaces) | `allowed-tools` neither grants nor restricts tools; `model`, `effort`, and `compatibility` are accepted but not applied. |
| [Mistral Vibe](https://docs.mistral.ai/vibe/code/cli/skills) | `allowed-tools` restricts callable tools; project discovery requires a trusted directory. |
| [GitHub Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/skills) | Custom-agent skills can be eagerly injected; subagents do not automatically inherit parent skills. |

Prior art: [Anthropic skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator)
uses comparisons and transcript review; [Claude team lessons](https://claude.dev/blog/lessons-from-building-claude-code-how-we-use-skills/)
favor observed gotchas and flexible constraints. Generalize these methods.
