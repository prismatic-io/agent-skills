import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vitest";

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawnSync: spawn }));
vi.mock("./component-agents.ts", () => ({ componentAgentNames: ["codex"] }));

import {
  launchEnvironment,
  launchLux,
  withLaunchEnvironment,
} from "./launch-environment.ts";
import { runLux } from "./run-lux.ts";
import { runSkillEvals } from "./run-skill-evals.ts";

afterEach(() => {
  vi.unstubAllEnvs();
  spawn.mockReset();
});

const host = {
  PATH: "/fake/tools:/usr/bin:/bin",
  HOME: "/fake/home",
  TMPDIR: "/fake/temp",
  LANG: "en_US.UTF-8",
  TERM: "xterm-256color",
  CODEX_HOME: "/fake/codex",
  GROK_HOME: "/fake/grok",
  PRISM_CONFIG_FILE: "/fake/prism.yml",
  PRISM_PROFILE: "test",
  PRISM_READ_ONLY: "true",
  PRISM_REUSE_PROFILE: "1",
  PRISM_MIGRATION_SKILL: "none",
  PRISM_EVAL_FIXTURE: "/fake/continuation-fixture",
  ANTIGRAVITY_AUTH_TOKEN_FILE: "/fake/oauth.json",
  ANTIGRAVITY_REUSE_KEYCHAIN: "1",
};
const unwanted = {
  SHORTCUT_API_TOKEN: "fake-shortcut-secret",
  LPASS_EMAIL: "fake-login@example.invalid",
  OPENAI_API_KEY: "fake-openai-secret",
  ANTHROPIC_API_KEY: "fake-anthropic-secret",
  GOOGLE_API_KEY: "fake-google-secret",
  XAI_API_KEY: "fake-xai-secret",
  ARBITRARY_FUTURE_CREDENTIAL: "fake-new-secret",
  ORDINARY_LOOKING_NAME: "fake-secret-without-keyword",
  LUX_CONFIG: "/fake/injected-config.ts",
  LUX_PROVIDER: "unrequested-provider",
  NODE_OPTIONS: "--require /fake/injected.cjs",
  NODE_PATH: "/fake/module-overrides",
  BASH_ENV: "/fake/startup",
  ZDOTDIR: "/fake/startup-dir",
};

test("allowlist preserves host/auth locations and explicit profile opt-ins, not arbitrary values", () => {
  const source = { ...host, ...unwanted, LC_TIME: undefined };
  expect(launchEnvironment(source)).toEqual(host);
  expect(source.SHORTCUT_API_TOKEN).toBe(unwanted.SHORTCUT_API_TOKEN);
  expect(launchEnvironment({})).toEqual({});
});

test("real child and grandchild receive only the selected environment", async () => {
  const { spawnSync } =
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    );
  const script = `const {spawnSync}=require('node:child_process'); const child=spawnSync(process.execPath,['-e','process.stdout.write(JSON.stringify(process.env))'],{encoding:'utf8'});if(child.status!==0)process.exit(1);process.stdout.write(child.stdout);`;
  const child = spawnSync(process.execPath, ["-e", script], {
    encoding: "utf8",
    env: launchEnvironment({ ...host, ...unwanted }),
  });
  expect(child.status).toBe(0);
  const received = JSON.parse(child.stdout);
  // macOS may add this runtime identity field after spawning a clean process.
  delete received.__CF_USER_TEXT_ENCODING;
  expect(received).toEqual(host);
});

test("direct wrapper preserves Lux arguments/exit status and filters before launch", async () => {
  spawn.mockReturnValue({ status: 1, signal: null });
  const args = [
    "run",
    "bespoke-mime-extraction",
    "--profile",
    "codex",
    "--runs-root",
    "/fake/runs",
  ];
  expect(await runLux(args, { ...host, ...unwanted })).toBe(1);
  expect(spawn).toHaveBeenCalledWith(
    process.execPath,
    [expect.stringContaining("/lux/lib/cli/bin.js"), ...args],
    {
      cwd: import.meta.dirname,
      stdio: "inherit",
      env: { ...host, ZDOTDIR: expect.stringContaining("lux-shell-startup-") },
    },
  );
});

test("explicit suite cwd selects its own config without changing Lux arguments", async () => {
  spawn.mockReturnValue({ status: 0, signal: null });
  await launchLux(
    ["run", "transfer-case"],
    { ...host, ...unwanted },
    "/fake/transfer-suite",
  );
  expect(spawn.mock.calls[0][1]).toEqual([
    expect.stringContaining("/lux/lib/cli/bin.js"),
    "run",
    "transfer-case",
  ]);
  expect(spawn.mock.calls[0][2].cwd).toBe("/fake/transfer-suite");
  expect(spawn.mock.calls[0][2].env.PRISM_MIGRATION_SKILL).toBe("none");
});

test("zsh login descendants cannot restore fake credentials from user startup files", async () => {
  const { spawnSync } =
    await vi.importActual<typeof import("node:child_process")>(
      "node:child_process",
    );
  const home = await mkdtemp(join(tmpdir(), "launch-env-home-"));
  let shellHome = "";
  try {
    await writeFile(
      join(home, ".zshenv"),
      "export FAKE_ZSHENV_CREDENTIAL=fixture\n",
    );
    await writeFile(
      join(home, ".zprofile"),
      "export FAKE_ZPROFILE_CREDENTIAL=fixture\n",
    );
    await mkdir(join(home, "native-auth"));
    const control = spawnSync(
      "/bin/zsh",
      ["-lc", "[[ -v FAKE_ZSHENV_CREDENTIAL && -v FAKE_ZPROFILE_CREDENTIAL ]]"],
      {
        env: { HOME: home, PATH: "/usr/bin:/bin" },
        encoding: "utf8",
      },
    );
    expect(control.status).toBe(0);
    const script =
      "if [[ -v FAKE_ZSHENV_CREDENTIAL || -v FAKE_ZPROFILE_CREDENTIAL ]]; then exit 42; fi; [[ -d $HOME/native-auth ]] || exit 43; /bin/zsh -lc '[[ ! -v FAKE_ZSHENV_CREDENTIAL && ! -v FAKE_ZPROFILE_CREDENTIAL ]]'";
    const result = await withLaunchEnvironment(
      { HOME: home, PATH: "/usr/bin:/bin", ...unwanted },
      (env) => {
        shellHome = env.ZDOTDIR ?? "";
        return spawnSync("/bin/zsh", ["-lc", script], {
          env,
          encoding: "utf8",
        });
      },
    );
    expect(result.status).toBe(0);
    await expect(access(shellHome)).rejects.toThrow();
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("matrix filters both ambient environment and caller overrides", async () => {
  for (const [key, value] of Object.entries(unwanted)) vi.stubEnv(key, value);
  vi.stubEnv("PRISM_READ_ONLY", "false");
  spawn.mockReturnValue({ status: 0, signal: null });
  expect(
    await runSkillEvals(
      "migration-skill",
      ["--help"],
      {
        PRISM_READ_ONLY: "true",
        LUX_CONFIG: "/fake/override.ts",
        UNRELATED_TOKEN: "fake-override-secret",
      },
      ["claude-code", "antigravity"],
    ),
  ).toBe(0);
  expect(spawn).toHaveBeenCalledTimes(2);
  for (const [, , options] of spawn.mock.calls) {
    expect(options.env.PRISM_READ_ONLY).toBe("true");
    for (const key of [...Object.keys(unwanted), "UNRELATED_TOKEN"]) {
      if (key === "ZDOTDIR")
        expect(options.env.ZDOTDIR).toContain("lux-shell-startup-");
      else expect(options.env).not.toHaveProperty(key);
    }
  }
});

// Real disposable auth files, mocked native processes: no provider calls.
test.each([false, true])(
  "Grok setup filters preflight env and cleans private state (failure=%s)",
  async (fail) => {
    const home = await mkdtemp(join(tmpdir(), "launch-grok-"));
    const privatePaths: string[] = [];
    try {
      await writeFile(join(home, "auth.json"), '{"fixture":true}');
      spawn.mockImplementation((command, _args, options) => {
        const env = options.env;
        expect(env).not.toHaveProperty("ARBITRARY_FUTURE_CREDENTIAL");
        privatePaths.push(env.ZDOTDIR);
        if (command === "grok") {
          privatePaths.push(env.GROK_HOME);
          expect(env.GROK_LOGIN_ENV).toBe("0");
          if (fail) return { status: 1 };
          return {
            status: 0,
            stdout: JSON.stringify({
              skills: [],
              projectInstructions: [],
              plugins: [],
              agents: [],
              hooks: [],
              mcpServers: [],
              lspServers: [],
            }),
          };
        }
        expect(env.PRISM_EVAL_GROK_ISOLATED).toBe("1");
        return { status: 0 };
      });
      const run = launchLux(["run", "case", "--driver=grok-build"], {
        ...host,
        ...unwanted,
        GROK_HOME: home,
      });
      if (fail) await expect(run).rejects.toThrow("preflight failed");
      else expect((await run).status).toBe(0);
      for (const path of privatePaths)
        await expect(access(path)).rejects.toThrow();
      await expect(access(join(home, "auth.json"))).resolves.toBeUndefined();
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  },
);

test("Antigravity private profile is removed even when Lux launch throws", async () => {
  const root = await mkdtemp(join(tmpdir(), "launch-prism-"));
  let staged = "";
  try {
    const config = join(root, "config.yml");
    await writeFile(
      config,
      JSON.stringify({
        version: 1,
        defaultProfile: "test",
        profiles: { test: { accessToken: "fixture" } },
      }),
    );
    spawn.mockImplementation((_command, _args, options) => {
      staged = options.env.PRISM_EVAL_CONFIG_DIR;
      expect(staged).toBeTruthy();
      throw new Error("fixture launch failure");
    });
    await expect(
      launchLux(["run", "case", "--profile", "antigravity"], {
        ...host,
        PRISM_CONFIG_FILE: config,
      }),
    ).rejects.toThrow("fixture launch failure");
    await expect(access(staged)).rejects.toThrow();
    await expect(access(config)).resolves.toBeUndefined();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
