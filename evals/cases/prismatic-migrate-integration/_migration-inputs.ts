import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";

const fixtureRoot = resolve(import.meta.dirname, "../../fixtures/migrations");
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
        return [input, files] as const;
      }),
  ),
);
