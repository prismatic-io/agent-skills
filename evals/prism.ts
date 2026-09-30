import { basename, resolve } from "node:path";

export const prismEnv = [
  "PRISMATIC_URL",
  "PRISM_PROFILE",
  "PRISM_CONFIG_FILE",
  "PRISM_ACCESS_TOKEN",
  "PRISM_REFRESH_TOKEN",
  "PRISMATIC_TENANT_ID",
];

export const prismBin = resolve(
  import.meta.dirname,
  ".lux-cache",
  basename(process.env.PRISM_ROOT ?? "prism"),
  "bin",
);
