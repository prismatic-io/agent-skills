export class UnsupportedInterface extends Error {}
export interface MembershipAdapter {
  flowStableKey?: string;
  invocationTimeoutMs?: number;
  configVars?: Record<string, unknown>;
}
export const scenarios: string[];
export const observeMembership: (
  invoke: (config: Record<string, string>) => Promise<unknown>,
  scenario: string,
  timeoutMs?: number,
) => Promise<unknown>;
export const verifyRegisteredMembership: (
  component: unknown,
  adapter: MembershipAdapter,
) => Promise<{
  passed: boolean;
  scenarios: number;
  failures: {
    scenario: string;
    message: string;
    expected: unknown;
    observed: unknown;
  }[];
  scope: string;
}>;
