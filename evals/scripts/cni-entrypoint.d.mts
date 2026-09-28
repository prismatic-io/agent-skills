/** Resolve Prism11's locally built index.js under a confined project root. */
export const resolveCniEntrypoint: (
  projectDirectory: string,
  workingDirectory?: string,
) => Promise<string>;
