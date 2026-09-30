import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
  createGrokIsolation,
  createPrismIsolation,
  disabledCodexSkills,
  prismIsolationSource,
} from "./agent-isolation.ts";

test("Prism staging matches blank environment input normalization", async () => {
  assert.deepEqual(
    prismIsolationSource(
      { PRISM_CONFIG_FILE: " ", PRISM_PROFILE: "\t", PRISMATIC_URL: "" },
      "/fake-home",
    ),
    {
      sourceFile: "/fake-home/.config/prism/config.yml",
      selectedProfile: undefined,
      legacyUrl: undefined,
    },
  );
  assert.equal(
    prismIsolationSource({ PRISM_PROFILE: " selected " }).selectedProfile,
    " selected ",
  );
});

test("Prism stages only the active profile and permits private atomic refresh", async () => {
  const root = await mkdtemp(join(tmpdir(), "eval-prism-test-"));
  try {
    const source = join(root, "config.yml");
    const original = JSON.stringify({
      version: 1,
      defaultProfile: "other",
      profiles: {
        other: {
          accessToken: "unselected-secret",
          refreshToken: "unselected-refresh",
          expiresIn: 3600,
          scope: "",
          tokenType: "Bearer",
          prismaticUrl: "https://other.invalid",
        },
        selected: {
          accessToken: "fake-token",
          refreshToken: "fake-refresh",
          expiresIn: 3600,
          scope: "",
          tokenType: "Bearer",
          prismaticUrl: "https://example.invalid",
        },
      },
    });
    await writeFile(source, original);
    const state = await createPrismIsolation(
      source,
      "selected",
      undefined,
      root,
    );
    assert.equal((await stat(state.directory)).mode & 0o777, 0o700);
    assert.equal((await stat(state.configFile)).mode & 0o777, 0o600);
    const staged = JSON.parse(await readFile(state.configFile, "utf8"));
    assert.equal(staged.defaultProfile, "selected");
    assert.deepEqual(Object.keys(staged.profiles), ["selected"]);
    assert.equal(staged.profiles.selected.accessToken, "fake-token");
    const temporaryFile = `${state.configFile}.refresh.tmp`;
    staged.profiles.selected.accessToken = "fake-refreshed-token";
    await writeFile(temporaryFile, JSON.stringify(staged), {
      mode: 0o600,
      flag: "wx",
    });
    await rename(temporaryFile, state.configFile);
    assert.equal((await stat(state.configFile)).mode & 0o777, 0o600);
    assert.equal(
      JSON.parse(await readFile(state.configFile, "utf8")).profiles.selected
        .accessToken,
      "fake-refreshed-token",
    );
    assert.equal(await readFile(source, "utf8"), original);
    await state.cleanup();
    assert.equal(existsSync(state.directory), false);
    await assert.rejects(
      () => createPrismIsolation(source, "missing", undefined, root),
      /unavailable/,
    );
    assert.deepEqual(await readdir(root), ["config.yml"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Prism legacy selection and malformed files never leak source text", async () => {
  const root = await mkdtemp(join(tmpdir(), "eval-prism-test-"));
  try {
    const source = join(root, "config.yml");
    await writeFile(
      source,
      "accessToken: fake-legacy-token\nrefreshToken: fake-refresh\nexpiresIn: 3600\nscope: ''\ntokenType: Bearer\n",
    );
    const state = await createPrismIsolation(
      source,
      undefined,
      "https://example.invalid",
      root,
    );
    const staged = JSON.parse(await readFile(state.configFile, "utf8"));
    assert.equal(
      staged.profiles.default.prismaticUrl,
      "https://example.invalid",
    );
    assert.equal(staged.profiles.default.refreshToken, "fake-refresh");
    await state.cleanup();
    await writeFile(source, "accessToken: [secret malformed");
    await assert.rejects(
      () => createPrismIsolation(source, undefined, undefined, root),
      { message: "Unable to read the selected Prism configuration" },
    );
    assert.deepEqual(await readdir(root), ["config.yml"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Grok copies only credentials into private disposable native state", async () => {
  const root = await mkdtemp(join(tmpdir(), "eval-isolation-test-"));
  try {
    const source = join(root, "source");
    await mkdir(source);
    await writeFile(join(source, "auth.json"), '{"test":"not-a-credential"}');
    await writeFile(join(source, "config.toml"), "unrelated user config");
    const state = await createGrokIsolation(source, root);
    assert.equal((await stat(state.directory)).mode & 0o777, 0o700);
    assert.equal(
      (await stat(join(state.directory, "auth.json"))).mode & 0o777,
      0o600,
    );
    assert.deepEqual((await readdir(state.directory)).sort(), [
      "auth.json",
      "config.toml",
    ]);
    assert.equal(
      await readFile(join(state.directory, "auth.json"), "utf8"),
      '{"test":"not-a-credential"}',
    );
    const config = await readFile(join(state.directory, "config.toml"), "utf8");
    assert.match(config, /\[claude_compat\]\nimported = true\n/);
    assert.match(config, /\[skills\]\nignore = /);
    assert.doesNotMatch(config, /unrelated user config/);
    assert.equal(state.env.GROK_CLAUDE_SKILLS_ENABLED, "false");
    assert.equal(state.env.GROK_CURSOR_HOOKS_ENABLED, "false");
    assert.equal(state.env.GROK_LOGIN_ENV, "0");
    assert.equal(state.env.GROK_MEMORY, "0");
    await state.cleanup();
    assert.equal(existsSync(state.directory), false);
    assert.equal(
      await readFile(join(source, "config.toml"), "utf8"),
      "unrelated user config",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex skill overrides follow linked roots once and stop at skill boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "eval-isolation-test-"));
  try {
    const skills = join(root, "skills");
    const skill = join(skills, "one");
    await mkdir(join(skill, "assets", "irrelevant"), { recursive: true });
    await writeFile(join(skill, "SKILL.md"), "a skill");
    await writeFile(
      join(skill, "assets", "irrelevant", "SKILL.md"),
      "not a skill",
    );
    await symlink(skills, join(root, "linked"));
    await symlink(skills, join(skills, "cycle"));
    assert.deepEqual(
      await disabledCodexSkills([
        join(root, "missing"),
        join(root, "linked"),
        skills,
      ]),
      [{ path: join(await realpath(skill), "SKILL.md"), enabled: false }],
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
