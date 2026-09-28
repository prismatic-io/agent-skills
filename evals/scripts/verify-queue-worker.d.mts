export class UnsupportedInterface extends Error {}
export interface QueueAdapter {
  flowStableKey?: string;
  invocationTimeoutMs?: number;
  configVars?: Record<string, unknown>;
}
export const scenarios: string[];
export const observeQueue: (
  invoke: (config: Record<string, string>) => Promise<unknown>,
  scenario: string,
  timeoutMs?: number,
) => Promise<unknown>;
export const verifyRegisteredQueue: (
  component: unknown,
  adapter: QueueAdapter,
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
