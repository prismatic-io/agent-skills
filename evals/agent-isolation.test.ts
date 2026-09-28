// biome-ignore-all lint/style/noRestrictedImports: Exercise the synchronous profile setup and cleanup with disposable fixtures.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { createGrokIsolation, disabledCodexSkills } from "./agent-isolation.ts";

test("Grok copies only credentials into private disposable native state", () => {
  const root = mkdtempSync(join(tmpdir(), "eval-isolation-test-"));
  try {
    const source = join(root, "source");
    mkdirSync(source);
    writeFileSync(join(source, "auth.json"), '{"test":"not-a-credential"}');
    writeFileSync(join(source, "config.toml"), "unrelated user config");
    const state = createGrokIsolation(source, root);
    assert.equal(statSync(state.directory).mode & 0o777, 0o700);
    assert.equal(
      statSync(join(state.directory, "auth.json")).mode & 0o777,
      0o600,
    );
    assert.deepEqual(readdirSync(state.directory).sort(), [
      "auth.json",
      "config.toml",
    ]);
    assert.equal(
      readFileSync(join(state.directory, "auth.json"), "utf8"),
      '{"test":"not-a-credential"}',
    );
    const config = readFileSync(join(state.directory, "config.toml"), "utf8");
    assert.match(config, /\[claude_compat\]\nimported = true\n/);
    assert.match(config, /\[skills\]\nignore = /);
    assert.doesNotMatch(config, /unrelated user config/);
    assert.equal(state.env.GROK_CLAUDE_SKILLS_ENABLED, "false");
    assert.equal(state.env.GROK_CURSOR_HOOKS_ENABLED, "false");
    assert.equal(state.env.GROK_MEMORY, "0");
    state.cleanup();
    assert.equal(existsSync(state.directory), false);
    assert.equal(
      readFileSync(join(source, "config.toml"), "utf8"),
      "unrelated user config",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Codex skill overrides follow linked roots once and stop at skill boundaries", () => {
  const root = mkdtempSync(join(tmpdir(), "eval-isolation-test-"));
  try {
    const skills = join(root, "skills");
    const skill = join(skills, "one");
    mkdirSync(join(skill, "assets", "irrelevant"), { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "a skill");
    writeFileSync(
      join(skill, "assets", "irrelevant", "SKILL.md"),
      "not a skill",
    );
    symlinkSync(skills, join(root, "linked"));
    symlinkSync(skills, join(skills, "cycle"));
    assert.deepEqual(
      disabledCodexSkills([
        join(root, "missing"),
        join(root, "linked"),
        skills,
      ]),
      [{ path: join(realpathSync(skill), "SKILL.md"), enabled: false }],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
