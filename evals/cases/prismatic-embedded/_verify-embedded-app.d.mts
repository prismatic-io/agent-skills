import type { spawnSync } from "node:child_process";
import type { KeyObject } from "node:crypto";

export interface SignedInUser {
  email: string;
  password: string;
  id: string;
  customer: string;
}
export interface CheckResult {
  script: string;
  status: "passed" | "failed";
  error: string | null;
  exitCode?: number | null;
  signal?: string | null;
}
export const organizationId: string;
export const signedInUsers: SignedInUser[];
export const containsPrivateKey: (text: string) => boolean;
export const findBundledKey: (
  root: string,
  canary: string,
) => Promise<string[]>;
export const findPrivateKeys: (root: string) => Promise<string[]>;
export const findJwts: (value: unknown) => string[];
export const verifyRs256: (
  token: string,
  publicKey: string | KeyObject,
) => {
  header: Record<string, unknown>;
  claims: Record<string, unknown>;
  valid: boolean;
};
export const claimProblems: (
  claims: Record<string, unknown>,
  user: SignedInUser,
  now?: number,
) => string[];
export const checkTokenEndpoint: (
  root: string,
  options?: { tokenPath?: string; timeoutMs?: number },
) => Promise<string[]>;
export const verifyEmbeddedApp: (
  root: string,
  options?: {
    timeoutMs?: number;
    run?: typeof spawnSync;
    tokenPath?: string;
  },
) => Promise<{ ok: boolean; project: string; checks: CheckResult[] }>;
