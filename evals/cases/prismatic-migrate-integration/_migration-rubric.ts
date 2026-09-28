import { createHash } from "node:crypto";
import {
  type AssertionImpl,
  createRubricAssertion,
  defineAssertion,
  type HarnessModelConfig,
  inspectRunArtifact,
  type RubricConfig,
  RubricConfigSchema,
  type Run,
  readRunArtifactText,
  type z,
} from "@prismatic-io/lux";
export const MigrationRubricSchema = RubricConfigSchema;
export type MigrationRubricInput = z.input<typeof RubricConfigSchema>;

// Resolver closes over hashes frozen before subject execution, never rubric config.
export type MigrationHashResolver = (
  run: Run,
) => Readonly<Record<string, string>> | undefined;

export const prioritizeMigrationArtifacts = async (
  run: Run,
  initialHashes: Readonly<Record<string, string>>,
): Promise<Run> => {
  const changed: Run["artifacts"] = [],
    unchanged: Run["artifacts"] = [];
  for (const artifact of run.artifacts) {
    const inspected = await inspectRunArtifact(run, artifact.path);
    if (!inspected.stats?.isFile())
      throw new Error(
        inspected.issue ?? `Unreadable artifact: ${artifact.path}`,
      );
    const expected = initialHashes[artifact.path];
    // Public Lux reader preserves traversal/symlink/size checks. UTF-8
    // roundtripping conservatively prioritizes non-text binary originals.
    const hash =
      expected && inspected.stats.size <= 10 * 1024 * 1024
        ? createHash("sha256")
            .update(
              await readRunArtifactText(run, artifact.path, {
                maxBytes: 10 * 1024 * 1024,
              }),
            )
            .digest("hex")
        : undefined;
    const copied = { ...artifact, root: inspected.root };
    (expected && hash === expected ? unchanged : changed).push(copied);
  }
  // This view is solely for built-in rubric sampling of indexed artifacts.
  // It does not carry Lux's private WeakMap binding and must not be used as
  // a general-purpose Run for unindexed lookups.
  return { ...run, artifacts: [...changed, ...unchanged] };
};
export const createMigrationRubric = (
  harness?: HarnessModelConfig,
  hashResolver?: MigrationHashResolver,
  delegate: AssertionImpl<RubricConfig> = createRubricAssertion(harness),
) =>
  defineAssertion({
    type: "rubric",
    pluginVersion: "1",
    configSchema: RubricConfigSchema,
    async evaluate(config, run, context) {
      const initialHashes = hashResolver?.(run);
      const view = initialHashes
        ? await prioritizeMigrationArtifacts(run, initialHashes)
        : run;
      return delegate.evaluate(config, view, context);
    },
  });
