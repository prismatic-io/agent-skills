import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RubricEvidenceSchema,
  type Run,
  readRunArtifactText,
} from "@prismatic-io/lux";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleArtifacts } from "../../node_modules/@prismatic-io/lux/lib/assertions/rubric/internal.js";
import { bindRunArtifactEvidence } from "../../node_modules/@prismatic-io/lux/lib/core/artifact-evidence.js";
import {
  createMigrationRubric,
  prioritizeMigrationArtifacts,
} from "./_migration-rubric.ts";

const roots: string[] = [];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const fixture = async () => {
  const runDir = await mkdtemp(join(tmpdir(), "migration-rubric-"));
  roots.push(runDir);
  const root = join(runDir, "snapshot");
  await mkdir(root);
  return { root, run: { runDir, artifacts: [] } as unknown as Run };
};
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((p) => rm(p, { recursive: true, force: true })),
  );
});
describe("migration rubric evidence priority", () => {
  it("prioritizes new/modified files and retains source bytes and snapshot roots", async () => {
    const { root, run } = await fixture();
    const contents: Record<string, string> = {
      "original.js": "original",
      "existing-target.ts": "modified",
      "new.ts": "generated",
    };
    for (const [path, text] of Object.entries(contents)) {
      await writeFile(join(root, path), text);
      run.artifacts.push({ path, root });
    }
    const retained = structuredClone(run);
    const view = await prioritizeMigrationArtifacts(run, {
      "original.js": hash("original"),
      "existing-target.ts": hash("before"),
    });
    expect(view.artifacts.map((a) => a.path)).toEqual([
      "existing-target.ts",
      "new.ts",
      "original.js",
    ]);
    expect(run).toEqual(retained);
    for (const a of view.artifacts) {
      expect(await readRunArtifactText(view, a.path)).toBe(contents[a.path]);
      expect(await readFile(join(root, a.path), "utf8")).toBe(contents[a.path]);
    }
  });
  it("delegates unchanged criteria budgets model and lifecycle context without models", async () => {
    const { run } = await fixture();
    const evaluate = vi.fn(async () => ({ passed: true, score: 1 }));
    const plugin = createMigrationRubric(undefined, () => ({}), {
      type: "rubric",
      evaluate,
    });
    const config = plugin.configSchema.parse({
      type: "rubric",
      criteria: "same criterion",
      model: "fixed-model",
      evidence: { maxArtifactChars: 1234 },
      maxArtifactExcerpt: 999,
    });
    const context = { abortSignal: new AbortController().signal };
    await plugin.evaluate(config, run, context);
    const expected = config;
    expect(evaluate).toHaveBeenCalledWith(
      { ...expected, type: "rubric" },
      { ...run, artifacts: [] },
      context,
    );
  });
  it.each(["symlink", "traversal", "missing", "ambiguous"])(
    "rejects %s before delegation",
    async (kind) => {
      const { root, run } = await fixture();
      await writeFile(join(root, "valid.ts"), "valid");
      if (kind === "symlink") {
        await symlink(join(root, "valid.ts"), join(root, "linked.ts"));
        run.artifacts.push({ path: "linked.ts", root });
      } else if (kind === "traversal")
        run.artifacts.push({ path: "../secret.ts", root });
      else if (kind === "missing")
        run.artifacts.push({ path: "missing.ts", root });
      else
        run.artifacts.push(
          { path: "valid.ts", root },
          { path: "valid.ts", root: join(root, "other") },
        );
      const evaluate = vi.fn(async () => ({ passed: true, score: 1 }));
      const plugin = createMigrationRubric(undefined, () => ({}), {
        type: "rubric",
        evaluate,
      });
      const config = plugin.configSchema.parse({
        type: "rubric",
        criteria: "same",
      });
      await expect(plugin.evaluate(config, run)).rejects.toThrow();
      expect(evaluate).not.toHaveBeenCalled();
    },
  );
  it("spends the real sampler budget on generated evidence before large originals", async () => {
    const { root, run } = await fixture();
    const original = "original".repeat(8);
    await writeFile(join(root, "source.js"), original);
    await writeFile(join(root, "target.ts"), "TARGET_EVIDENCE");
    run.artifacts.push(
      { path: "source.js", root },
      { path: "target.ts", root },
    );
    const view = await prioritizeMigrationArtifacts(run, {
      "source.js": hash(original),
    });
    const evidence = RubricEvidenceSchema.parse({ maxArtifactChars: 20 });
    const sampled = await sampleArtifacts(view, 20, evidence);
    expect(sampled).toContain("--- target.ts ---\nTARGET_EVIDENCE");
    const originalOrder = await sampleArtifacts(run, 20, evidence);
    expect(originalOrder).not.toContain("TARGET_EVIDENCE");
    expect(run.artifacts.map((a) => a.path)).toEqual([
      "source.js",
      "target.ts",
    ]);
  });
  it("retains the bound snapshot root for every indexed sampler read", async () => {
    const { root, run } = await fixture();
    await writeFile(join(root, "target.ts"), "SNAPSHOT_EVIDENCE");
    await writeFile(join(root, "unindexed.ts"), "UNINDEXED_SECRET");
    await mkdir(join(run.runDir, "artifacts"));
    await writeFile(join(run.runDir, "artifacts", "target.ts"), "HOST_DECOY");
    run.artifacts.push({ path: "target.ts" });
    bindRunArtifactEvidence(run, { root, indexedOnly: true });
    await expect(readRunArtifactText(run, "unindexed.ts")).rejects.toThrow(
      "not captured",
    );
    const view = await prioritizeMigrationArtifacts(run, {});
    expect(view.artifacts[0].root).toBe(root);
    const sampled = await sampleArtifacts(
      view,
      100,
      RubricEvidenceSchema.parse({}),
    );
    expect(sampled).toContain("SNAPSHOT_EVIDENCE");
    expect(sampled).not.toContain("HOST_DECOY");
    expect(sampled).not.toContain("UNINDEXED_SECRET");
    expect(run.artifacts[0].root).toBeUndefined();
  });
  it("delegates ordinary rubrics with the original bound Run identity", async () => {
    const { root, run } = await fixture();
    bindRunArtifactEvidence(run, { root, indexedOnly: true });
    const evaluate = vi.fn(async (_config: unknown, _run: Run) => ({
      passed: true,
      score: 1,
    }));
    const plugin = createMigrationRubric(undefined, undefined, {
      type: "rubric",
      evaluate,
    });
    const config = plugin.configSchema.parse({
      type: "rubric",
      criteria: "ordinary",
    });
    await plugin.evaluate(config, run);
    expect(evaluate.mock.calls[0][1]).toBe(run);
    expect(evaluate.mock.calls[0][0]).not.toHaveProperty("initialHashes");
  });
  it("uses grader-only frozen hashes through the Run resolver with builtin schema", async () => {
    const { root, run } = await fixture();
    await writeFile(join(root, "source.ts"), "source");
    await writeFile(join(root, "port.ts"), "port");
    run.artifacts.push({ path: "source.ts", root }, { path: "port.ts", root });
    const hashes = Object.freeze({ "source.ts": hash("source") });
    const resolver = vi.fn((observed: Run) => {
      expect(observed).toBe(run);
      return hashes;
    });
    const evaluate = vi.fn(async (_config: unknown, observed: Run) => {
      expect(observed.artifacts.map((a) => a.path)).toEqual([
        "port.ts",
        "source.ts",
      ]);
      return { passed: true, score: 1 };
    });
    const plugin = createMigrationRubric(undefined, resolver, {
      type: "rubric",
      evaluate,
    });
    const config = plugin.configSchema.parse({
      type: "rubric",
      criteria: "same",
    });
    expect(() =>
      plugin.configSchema.parse({ ...config, initialHashes: hashes }),
    ).toThrow();
    await plugin.evaluate(config, run);
    expect(resolver).toHaveBeenCalledOnce();
    expect(evaluate.mock.calls[0][0]).toBe(config);
  });
});
