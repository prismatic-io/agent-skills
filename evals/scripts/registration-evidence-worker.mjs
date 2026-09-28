// biome-ignore lint/style/noRestrictedImports: Write to an inherited IPC descriptor, not a filesystem path.
import { writeSync } from "node:fs";
import { inspectBuiltProject } from "./inspect-cni-registration.mjs";

// Parent discards stdout/stderr at the OS boundary, including direct fd writes.
// Only this dedicated channel is considered attachment data.
try {
  const registration = await inspectBuiltProject(process.argv[2]);
  writeSync(3, JSON.stringify({ status: "available", registration }));
} catch {
  // Module errors can contain credentials/defaults. Never serialize their text.
  writeSync(
    3,
    JSON.stringify({
      status: "unavailable",
      reason: "registration-import-or-shape-check-failed",
    }),
  );
}
