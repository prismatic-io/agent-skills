import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

// Capture source identity while configuration loads, before subjects run.
const fixtureRoot = resolve(import.meta.dirname, "../../fixtures/migrations");
export const fixtureHashes = new Map<string, Record<string, string>>();
export const fixtureInventory = new Map(
  await Promise.all(
    (await readdir(fixtureRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const input = resolve(fixtureRoot, entry.name, "input");
        const files = (
          await readdir(input, { recursive: true, withFileTypes: true })
        )
          .filter((file) => file.isFile())
          .map((file) => relative(input, resolve(file.parentPath, file.name)))
          .sort();
        fixtureHashes.set(
          input,
          Object.fromEntries(
            await Promise.all(
              files.map(
                async (file) =>
                  [
                    file,
                    createHash("sha256")
                      .update(await readFile(resolve(input, file)))
                      .digest("hex"),
                  ] as const,
              ),
            ),
          ),
        );
        return [input, files] as const;
      }),
  ),
);
