// biome-ignore-all lint/style/noRestrictedImports: Native profile getters and process exit cleanup require synchronous filesystem access.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, parse } from "node:path";

/** Disable installed skills without changing the user's files or HOME. */
export const disabledCodexSkills = (
  roots = [join(homedir(), ".agents/skills"), "/etc/codex/skills"],
): { path: string; enabled: false }[] => {
  const paths = new Set<string>();
  const visited = new Set<string>();
  const visit = (path: string): void => {
    let canonical: string;
    try {
      canonical = realpathSync(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (visited.has(canonical)) return;
    visited.add(canonical);
    if (!lstatSync(canonical).isDirectory()) return;
    const entries = readdirSync(canonical, { withFileTypes: true });
    if (entries.some((entry) => entry.name === "SKILL.md" && entry.isFile())) {
      paths.add(join(canonical, "SKILL.md"));
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        visit(join(canonical, entry.name));
      }
    }
  };
  for (const root of roots) visit(root);
  return [...paths].sort().map((path) => ({ path, enabled: false }));
};

/** Native Grok configuration, not a replacement agent/transport. */
export const createGrokIsolation = (
  sourceDir = process.env.GROK_HOME ?? join(homedir(), ".grok"),
  parentDir = tmpdir(),
) => {
  const directory = mkdtempSync(join(parentDir, "prismatic-eval-grok-"));
  chmodSync(directory, 0o700);
  const cleanup = () => rmSync(directory, { recursive: true, force: true });
  try {
    const sourceAuth = join(sourceDir, "auth.json");
    try {
      if (!lstatSync(sourceAuth).isFile()) {
        throw new Error("Grok auth.json must be a regular file");
      }
      copyFileSync(sourceAuth, join(directory, "auth.json"));
      chmodSync(join(directory, "auth.json"), 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    // These evals explicitly read the frozen subject path. Disable every
    // implicitly discovered skill, including ~/.agents and bundled skills.
    const root = parse(realpathSync(directory)).root;
    // Permission and environment imports use a separate Claude compatibility
    // loader; disabling compat.claude.rules does not disable that loader.
    writeFileSync(
      join(directory, "config.toml"),
      `[claude_compat]\nimported = true\n\n[skills]\nignore = [${JSON.stringify(root)}]\n\n[memory]\nenabled = false\n\n[workflows]\nenabled = false\n\n${[
        "claude",
        "cursor",
        "codex",
      ]
        .map(
          (vendor) =>
            `[compat.${vendor}]\nskills = false\nrules = false\nagents = false\nmcps = false\nhooks = false\nsessions = false\n`,
        )
        .join("\n")}`,
      { mode: 0o600 },
    );
    const env: Record<string, string> = {
      GROK_HOME: directory,
      GROK_CONFIG: "{}",
      GROK_CONFIG_PATH: "",
      GROK_MEMORY: "0",
      GROK_WORKFLOWS: "0",
    };
    for (const vendor of ["CLAUDE", "CURSOR"]) {
      for (const surface of ["SKILLS", "RULES", "AGENTS", "MCPS", "HOOKS"]) {
        env[`GROK_${vendor}_${surface}_ENABLED`] = "false";
      }
    }
    return { directory, env, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
};

type GrokInspection = {
  skills?: { disabled?: boolean }[];
  projectInstructions?: { disabled?: boolean }[];
  plugins?: { name: string; enabled?: boolean }[];
  agents?: { source?: { type?: string } }[];
  hooks?: unknown[];
  mcpServers?: unknown[];
  lspServers?: unknown[];
};

export const inspectGrokIsolation = (
  state: ReturnType<typeof createGrokIsolation>,
): GrokInspection => {
  const inspect = (): GrokInspection => {
    const result = spawnSync("grok", ["inspect", "--json"], {
      cwd: state.directory,
      env: { ...process.env, ...state.env },
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 4_000_000,
    });
    if (result.error || result.status !== 0) {
      throw new Error("Grok discovery isolation preflight failed");
    }
    const report = JSON.parse(result.stdout) as GrokInspection;
    for (const key of [
      "skills",
      "projectInstructions",
      "plugins",
      "agents",
      "hooks",
      "mcpServers",
      "lspServers",
    ] as const) {
      if (!Array.isArray(report[key])) {
        throw new Error(`Grok inspection omitted ${key}`);
      }
    }
    return report;
  };
  // Compatibility skills can be disabled while their plugin remains enabled.
  // Disable every discovered plugin as well, using Grok's native config.
  const plugins = inspect().plugins ?? [];
  if (plugins.length > 0) {
    appendFileSync(
      join(state.directory, "config.toml"),
      `\n[plugins]\ndisabled = ${JSON.stringify(plugins.map(({ name }) => name))}\n`,
    );
  }
  const result = inspect();
  if (
    result.skills?.some((skill) => !skill.disabled) ||
    result.projectInstructions?.some((instruction) => !instruction.disabled) ||
    // Grok 1.0.40's plugin inventory still says enabled after native disable;
    // inspect the resolved contributions instead of this inventory flag.
    result.agents?.some((agent) => agent.source?.type !== "builtin") ||
    result.hooks?.length ||
    result.mcpServers?.length ||
    result.lspServers?.length
  ) {
    throw new Error("Grok still discovers enabled external configuration");
  }
  return result;
};

let grokIsolation: ReturnType<typeof createGrokIsolation> | undefined;
export const grokIsolationEnv = (): Record<string, string> => {
  if (!grokIsolation) {
    const state = createGrokIsolation();
    try {
      inspectGrokIsolation(state);
    } catch (error) {
      state.cleanup();
      throw error;
    }
    grokIsolation = state;
    process.once("exit", grokIsolation.cleanup);
  }
  return grokIsolation.env;
};
