export class UnsupportedInterface extends Error {}
export interface CsvAdapter {
  flowStableKey?: string;
  inputField?: string;
  triggerBodyField?: "body" | "rawBody";
  acceptedField?: string;
  rejectedField?: string;
}
export const samples: { name: string; csv: string }[];
export const sourceResult: (csv: string) => {
  accepted: string;
  rejected: string;
  error?: string;
};
export const verifyRegisteredCsv: (
  component: unknown,
  adapter: CsvAdapter,
) => Promise<{
  passed: boolean;
  scenarios: number;
  failures: { scenario: string; message: string }[];
  scope: string;
}>;
