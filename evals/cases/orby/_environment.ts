import { resolve } from "node:path";
import { prismBin } from "../../prism.ts";

export const prismEnvironment = `Prism is installed at ${resolve(prismBin, "prism")}. Use this installed executable rather than downloading a replacement.`;

export const localProjectEnvironment = `${prismEnvironment} Prism's inherited PRISM_READ_ONLY setting also blocks local project writes. For commands whose only mutations are local project files, use a command-scoped override without changing the parent environment. Keep read-only mode enabled for remote commands.`;
