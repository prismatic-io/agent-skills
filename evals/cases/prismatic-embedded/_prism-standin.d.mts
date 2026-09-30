export const isAgentMode: (argv: string[], env: NodeJS.ProcessEnv) => boolean;
export const simulatedCommand: (
  argv: string[],
) => "generate" | "import" | "list" | "delete" | undefined;
export const logPath: (
  cwd: string,
  logs: { name: string; fallback: string },
) => string;
export const keyProbe: (privateKey: string) => string;
export const runSimulated: (
  command: string,
  argv: string[],
  context: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<{
  output: Record<string, unknown>;
  record: Record<string, unknown>;
}>;

export const luxWorkspace: (cwd: string) => string | undefined;
export const isMetadataCommand: (argv: string[]) => boolean;
