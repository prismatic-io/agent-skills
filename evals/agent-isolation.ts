import { spawnSync } from "node:child_process";
import {
  appendFile,
  chmod,
  copyFile,
  lstat,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, parse } from "node:path";
import { parse as parseYaml } from "yaml";

/** Stage only the selected Prism profile; token refresh stays in private state. */
export const createPrismIsolation = async (
  sourceFile: string,
  selectedProfile?: string,
  legacyUrl = "https://app.prismatic.io",
  parentDir = tmpdir(),
) => {
  let raw: Record<string, unknown>;
  try {
    raw = parseYaml(await readFile(sourceFile, "utf8"));
  } catch {
    // Parser errors can include source lines containing credentials.
    throw new Error("Unable to read the selected Prism configuration");
  }
  if (!raw || typeof raw !== "object")
    throw new Error("Invalid Prism configuration");
  const legacy =
    !("version" in raw) && !("profiles" in raw) && "accessToken" in raw;
  const name = selectedProfile || (legacy ? "default" : raw.defaultProfile);
  const profiles = legacy
    ? { default: { ...raw, prismaticUrl: legacyUrl } }
    : raw.profiles;
  if (
    (!legacy && raw.version !== 1) ||
    typeof name !== "string" ||
    !name ||
    !profiles ||
    typeof profiles !== "object" ||
    !Object.hasOwn(profiles, name)
  )
    throw new Error("Selected Prism profile is unavailable");
  const profile = (profiles as Record<string, unknown>)[name];
  if (!profile || typeof profile !== "object")
    throw new Error("Invalid selected Prism profile");
  const directory = await mkdtemp(join(parentDir, "prismatic-eval-prism-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  const configFile = join(directory, "config.yml");
  try {
    await chmod(directory, 0o700);
    // JSON is valid YAML, and safely handles arbitrary profile names.
    await writeFile(
      configFile,
      JSON.stringify({
        version: 1,
        defaultProfile: name,
        profiles: { [name]: profile },
      }),
      { mode: 0o600 },
    );
    return { directory, configFile, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
};

// Match Prism's env.ts: blank action inputs are unset; nonblank values retain
// their original text (including meaningful whitespace in a path/profile name).
export const prismIsolationSource = (
  environment: NodeJS.ProcessEnv = process.env,
  homeDirectory = homedir(),
) => {
  const optional = (value: string | undefined) =>
    value?.trim() ? value : undefined;
  return {
    sourceFile:
      optional(environment.PRISM_CONFIG_FILE) ??
      join(homeDirectory, ".config/prism/config.yml"),
    selectedProfile: optional(environment.PRISM_PROFILE),
    legacyUrl: optional(environment.PRISMATIC_URL),
  };
};

/** Disable installed skills without changing the user's files or HOME. */
export const disabledCodexSkills = async (
  roots = [join(homedir(), ".agents/skills"), "/etc/codex/skills"],
): Promise<{ path: string; enabled: false }[]> => {
  const paths = new Set<string>();
  const visited = new Set<string>();
  const visit = async (path: string): Promise<void> => {
    let canonical: string;
    try {
      canonical = await realpath(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    if (visited.has(canonical)) return;
    visited.add(canonical);
    if (!(await lstat(canonical)).isDirectory()) return;
    const entries = await readdir(canonical, { withFileTypes: true });
    if (entries.some((entry) => entry.name === "SKILL.md" && entry.isFile())) {
      paths.add(join(canonical, "SKILL.md"));
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        await visit(join(canonical, entry.name));
      }
    }
  };
  for (const root of roots) await visit(root);
  return [...paths].sort().map((path) => ({ path, enabled: false }));
};

/** Native Grok configuration, not a replacement agent/transport. */
export const createGrokIsolation = async (
  sourceDir = process.env.GROK_HOME ?? join(homedir(), ".grok"),
  parentDir = tmpdir(),
) => {
  const directory = await mkdtemp(join(parentDir, "prismatic-eval-grok-"));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    await chmod(directory, 0o700);
    const sourceAuth = join(sourceDir, "auth.json");
    try {
      if (!(await lstat(sourceAuth)).isFile()) {
        throw new Error("Grok auth.json must be a regular file");
      }
      await copyFile(sourceAuth, join(directory, "auth.json"));
      await chmod(join(directory, "auth.json"), 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    // These evals explicitly read the frozen subject path. Disable every
    // implicitly discovered skill, including ~/.agents and bundled skills.
    const root = parse(await realpath(directory)).root;
    // Permission and environment imports use a separate Claude compatibility
    // loader; disabling compat.claude.rules does not disable that loader.
    await writeFile(
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
      // Disable native login-shell capture so sanitized launch variables stay isolated.
      GROK_LOGIN_ENV: "0",
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
    await cleanup();
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

export const inspectGrokIsolation = async (
  state: Awaited<ReturnType<typeof createGrokIsolation>>,
  environment: NodeJS.ProcessEnv,
): Promise<GrokInspection> => {
  const inspect = (): GrokInspection => {
    const result = spawnSync("grok", ["inspect", "--json"], {
      cwd: state.directory,
      env: { ...environment, ...state.env },
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
    await appendFile(
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

// Setup and cleanup belong to the awaited launcher, not synchronous config getters.
export const prismIsolationState = () => {
  if (process.env.PRISM_REUSE_PROFILE !== "1") return undefined;
  const directory = process.env.PRISM_EVAL_CONFIG_DIR;
  const configFile = process.env.PRISM_EVAL_CONFIG_FILE;
  if (!directory || !configFile)
    throw new Error(
      "Launch the Antigravity profile through run-lux.ts to stage Prism authentication",
    );
  return { directory, configFile };
};

export const grokIsolationEnv = (): Record<string, string> => {
  if (process.env.PRISM_EVAL_GROK_ISOLATED !== "1")
    throw new Error(
      "Launch the Grok profile through run-lux.ts to stage native isolation",
    );
  return Object.fromEntries(
    Object.entries(process.env).filter(
      ([name, value]) => name.startsWith("GROK_") && value !== undefined,
    ),
  ) as Record<string, string>;
};
