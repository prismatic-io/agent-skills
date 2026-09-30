import { Socket } from "node:net";
import { finished } from "node:stream/promises";
import { inspectBuiltProject } from "./_inspect-cni-registration.mjs";

// Parent discards stdout/stderr at the OS boundary, including direct fd writes.
// Only this dedicated channel is considered attachment data.
let payload;
try {
  const registration = await inspectBuiltProject(process.argv[2]);
  payload = { status: "available", registration };
} catch {
  // Module errors can contain credentials/defaults. Never serialize their text.
  payload = {
    status: "unavailable",
    reason: "registration-import-or-shape-check-failed",
  };
}
const channel = new Socket({ fd: 3, readable: false, writable: true });
channel.end(JSON.stringify(payload));
await finished(channel);
