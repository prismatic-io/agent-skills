# Working on skills

Use [mise.toml](mise.toml) for development tasks and [README.md](README.md#releases)
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
