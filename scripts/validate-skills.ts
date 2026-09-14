import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { parse } from "yaml";

const fields = new Set([
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "allowed-tools",
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Check the portable fields documented at https://agentskills.io/specification. */
export const validateFrontmatter = (
  content: string,
  directoryName: string,
): string[] => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match?.[1]) return ["Missing or unterminated YAML frontmatter"];
  let data: unknown;
  try {
    data = parse(match[1]);
  } catch (error) {
    return [`Invalid YAML: ${String(error)}`];
  }
  if (!isRecord(data)) return ["Frontmatter must be a mapping"];
  const errors: string[] = [];
  for (const field of Object.keys(data)) {
    if (!fields.has(field))
      errors.push(`Unsupported frontmatter field: ${field}`);
  }
  for (const [field, limit] of [
    ["name", 64],
    ["description", 1024],
    ["compatibility", 500],
  ] as const) {
    if (field === "compatibility" && !(field in data)) continue;
    const value = data[field];
    if (
      typeof value !== "string" ||
      !value.trim() ||
      [...value].length > limit
    ) {
      errors.push(
        `${field} must be a nonempty string of at most ${limit} characters`,
      );
    }
  }
  if (typeof data.name === "string") {
    const name = data.name;
    if (
      name !== name.toLowerCase() ||
      !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(name)
    ) {
      errors.push(
        "name must use lowercase letters, numbers, and single separating hyphens",
      );
    }
    if (name !== directoryName) errors.push("name must match its directory");
  }
  for (const field of ["license", "allowed-tools"]) {
    if (field in data && typeof data[field] !== "string")
      errors.push(`${field} must be a string`);
  }
  if (
    "metadata" in data &&
    (!isRecord(data.metadata) ||
      Object.values(data.metadata).some((value) => typeof value !== "string"))
  ) {
    errors.push("metadata must map strings to strings; quote version values");
  }
  return errors;
};

export const check = async (
  root: string,
  requireSkills = false,
): Promise<{ errors: string[]; count: number }> => {
  const errors: string[] = [];
  let count = 0;
  const container = join(root, "skills");
  if (!existsSync(container) || !(await stat(container)).isDirectory()) {
    return { errors: ["Missing skills/ directory"], count };
  }
  if (existsSync(join(root, "SKILL.md")))
    errors.push("Root SKILL.md can hide the collection from CLI discovery");
  for (const directory of (
    await readdir(container, { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!directory.isDirectory()) continue;
    const path = join(container, directory.name);
    const entry = join(path, "SKILL.md");
    if (!existsSync(entry) || !(await stat(entry)).isFile()) {
      errors.push(`skills/${directory.name}: missing SKILL.md`);
      continue;
    }
    count++;
    errors.push(
      ...validateFrontmatter(await readFile(entry, "utf8"), directory.name).map(
        (error) => `skills/${directory.name}: ${error}`,
      ),
    );
    for (const nested of await readdir(path, {
      recursive: true,
      encoding: "utf8",
    })) {
      if (nested !== "SKILL.md" && basename(nested) === "SKILL.md")
        errors.push(
          `skills/${directory.name}/${nested}: nested skill; use a sibling folder`,
        );
    }
  }
  if (requireSkills && count === 0)
    errors.push("At least one complete skill is required before release");
  return { errors, count };
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--require-skills")) {
    console.error("Usage: mise run validate [--require-skills]");
    process.exit(1);
  }
  const { errors, count } = await check(
    resolve(import.meta.dirname, ".."),
    args.includes("--require-skills"),
  );
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log(
    count
      ? `Validated ${count} skill(s).`
      : "Scaffold valid; no installable skills yet.",
  );
}
