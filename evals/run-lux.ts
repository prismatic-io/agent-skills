import { launchLux } from "./launch-environment.ts";

// Direct profiles/cases use the same outer environment boundary as the matrix.
// All Lux arguments and exit codes are preserved; this changes no permissions,
// model settings, case criteria, or grading policy.
export const runLux = async (
  args = process.argv.slice(2),
  environment: NodeJS.ProcessEnv = process.env,
) => {
  const result = await launchLux(args, environment);
  if (result.error) console.error(result.error.message);
  if (result.signal) console.error(`Lux terminated by ${result.signal}`);
  return result.status ?? 1;
};

if (import.meta.main) process.exitCode = await runLux();
