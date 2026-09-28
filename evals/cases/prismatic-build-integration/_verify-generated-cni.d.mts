import type { spawnSync } from "node:child_process";
export interface CheckResult {
  script: string;
  status: "missing" | "passed" | "failed";
  error: string | null;
  exitCode?: number | null;
  signal?: string | null;
}
export const findCniProjects: (
  root: string,
) => Promise<
  Array<{ directory: string; manifest: { scripts?: Record<string, string> } }>
>;
export const verifyCni: (
  root: string,
  options?: { timeoutMs?: number; run?: typeof spawnSync },
) => Promise<{
  ok: boolean;
  error?: string;
  project?: string;
  checks: CheckResult[];
  entryLoad?: "checked" | "unassessed";
}>;
