import { spawnSync } from "node:child_process";

// Kill the whole POSIX process group when a generated project's check times out.
// Windows spawnSync bounds the direct child; detached process groups are unavailable.
export const runCheck = (
  script,
  { run = spawnSync, ...options },
  command = "npm",
  args = ["run", script],
) => {
  const result = run(command, args, {
    env: process.env,
    stdio: "inherit",
    ...options,
    killSignal: "SIGKILL",
    detached: process.platform !== "win32",
  });
  if (
    result.error?.code === "ETIMEDOUT" &&
    result.pid &&
    process.platform !== "win32"
  ) {
    try {
      process.kill(-result.pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  return {
    script,
    status: result.status === 0 && !result.error ? "passed" : "failed",
    exitCode: result.status,
    signal: result.signal ?? null,
    error: result.error?.message ?? null,
  };
};
