import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  createGrokIsolation,
  createPrismIsolation,
  inspectGrokIsolation,
  prismIsolationSource,
} from "./agent-isolation.ts";

// Lux drivers merge their own env with the Lux process environment. Filter at
// that outer boundary so subjects, personas, and graders share the same policy.
// Native CLI auth stays in its usual on-disk/keychain locations; provider API
// tokens and arbitrary shell/tool configuration are not inherited.
const inheritedNames = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TMP",
  "TEMP",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  "LC_COLLATE",
  "LC_MESSAGES",
  "LC_MONETARY",
  "LC_NUMERIC",
  "LC_TIME",
  "TERM",
  "COLORTERM",
  "NO_COLOR",
  "FORCE_COLOR",
  "CI",
  "TZ",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "XDG_STATE_HOME",
  "CODEX_HOME",
  "CLAUDE_CONFIG_DIR",
  "GROK_HOME",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "PATHEXT",
  "APPDATA",
  "LOCALAPPDATA",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "USERNAME",
  "PRISM_ROOT",
  "PRISM_CONFIG_FILE",
  "PRISM_PROFILE",
  "PRISMATIC_URL",
  "PRISM_READ_ONLY",
  "PRISM_REUSE_PROFILE",
  "PRISM_MIGRATION_SKILL",
  "PRISM_EVAL_FIXTURE",
  "EVAL_PRISM_BIN",
  // These are explicit host opt-ins already consumed by the AGY profile.
  // The token itself is staged privately by Lux; no token value is inherited.
  "ANTIGRAVITY_AUTH_TOKEN_FILE",
  "ANTIGRAVITY_REUSE_KEYCHAIN",
] as const;

export const launchEnvironment = (
  environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv => {
  const selected: NodeJS.ProcessEnv = {};
  for (const name of inheritedNames) {
    const value = environment[name];
    if (value !== undefined) selected[name] = value;
  }
  return selected;
};

export const withLaunchEnvironment = async <T>(
  environment: NodeJS.ProcessEnv,
  launch: (selected: NodeJS.ProcessEnv) => T,
): Promise<Awaited<T>> => {
  // Codex's native tools invoke zsh -lc. Retaining HOME for native auth while
  // redirecting zsh startup prevents ~/.zshenv and ~/.zprofile from restoring
  // unrelated credentials after the parent environment has been filtered.
  const shellHome = await mkdtemp(join(tmpdir(), "lux-shell-startup-"));
  try {
    return await launch({
      ...launchEnvironment(environment),
      ZDOTDIR: shellHome,
    });
  } finally {
    await rm(shellHome, { recursive: true, force: true });
  }
};

export const launchLux = (
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  cwd = import.meta.dirname,
) =>
  withLaunchEnvironment(environment, async (selected) => {
    const cleanups: (() => Promise<void>)[] = [];
    try {
      const option = (name: string) => {
        const index = args.indexOf(name);
        return index < 0
          ? args
              .find((arg) => arg.startsWith(`${name}=`))
              ?.slice(name.length + 1)
          : args[index + 1];
      };
      const metadataOnly =
        args.some((arg) =>
          ["--list", "--list-tags", "--help", "-h"].includes(arg),
        ) || args[0] !== "run";
      const driver = option("--driver") ?? option("--profile") ?? "codex";
      if (
        !metadataOnly &&
        driver === "antigravity" &&
        selected.PRISM_REUSE_PROFILE === "1"
      ) {
        const source = prismIsolationSource(selected);
        const prism = await createPrismIsolation(
          source.sourceFile,
          source.selectedProfile,
          source.legacyUrl,
        );
        cleanups.push(prism.cleanup);
        selected.PRISM_EVAL_CONFIG_FILE = prism.configFile;
        selected.PRISM_EVAL_CONFIG_DIR = prism.directory;
      }
      if (!metadataOnly && driver === "grok-build") {
        const grok = await createGrokIsolation(
          selected.GROK_HOME ?? join(selected.HOME ?? homedir(), ".grok"),
        );
        cleanups.push(grok.cleanup);
        await inspectGrokIsolation(grok, selected);
        Object.assign(selected, grok.env, { PRISM_EVAL_GROK_ISOLATED: "1" });
      }
      return spawnSync(
        process.execPath,
        [
          resolve(
            import.meta.dirname,
            "node_modules/@prismatic-io/lux/lib/cli/bin.js",
          ),
          ...args,
        ],
        {
          cwd,
          stdio: "inherit",
          env: selected,
        },
      );
    } finally {
      for (const cleanup of cleanups.reverse()) await cleanup();
    }
  });
