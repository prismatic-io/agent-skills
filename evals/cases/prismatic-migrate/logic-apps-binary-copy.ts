import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "logic-apps-binary-copy",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/logic-apps-binary-copy/input",
  ),
  request:
    "Move this Dropbox-to-OneDrive Logic Apps template to Prismatic. The important part is that newly created files arrive with their original bytes and usable filenames. Verify external-service behavior with mocked accounts, publish and import a fresh Prismatic review integration, and identify the folder and connection settings we still need to supply.",
  persona:
    "You own the file backup integration. Files can be binary and filenames can contain spaces or non-ASCII characters. The source is the supplied public template; it is not a fully configured account export. The Dropbox folder and both accounts' credentials will be provided at deployment. No preference about implementation libraries or trigger style.",
  sourceContract:
    "The unchanged Microsoft dropbox-onedrive template uses Dropbox When_a_file_is_created with onnewfile, empty folderId and a 3-minute recurrence. OneDrive Create_file body is triggerBody(), destination folderPath is /backup from Dropbox, and name comes from triggerOutputs headers x-ms-file-name-encoded. Connection references are unbound. Source trigger provides file contents, not a JSON metadata record to write as file bytes. Azure connector routes (/datasets/default/...) are connector proxy contracts, not Dropbox/Graph public API routes. The encoded filename header needs interpretation using the source connector contract; its name alone does not establish an arbitrary URL/base64 decode algorithm. Microsoft connector reference: https://learn.microsoft.com/en-us/connectors/dropbox/ . No source rule for historical backfill, update propagation, duplicate-name overwrite, or deletion is supplied.",
  criteria: [
    {
      id: "file-content-and-name",
      criteria:
        "The registered target path copies actual new-file bytes into OneDrive's configured backup folder, preserving binary content and the intended filename. It does not serialize file metadata or a base64 wrapper as the file, decode binary through UTF-8, or silently double-encode/decode filenames. An implementation that obtains filename/content directly through documented native APIs can pass without emulating Azure trigger headers. A header-based translation must ground its encoding interpretation in the connector contract; disclose unsupported legacy encoding rather than invent it.",
    },
    {
      id: "new-file-source-boundary",
      criteria:
        "The integration has a credible supported mechanism for identifying newly created files in a deployer-selected Dropbox folder and uses distinct Dropbox/OneDrive connection configuration. A change feed that also reports modifications is not a creation-only trigger: the implementation must distinguish newly created files from updates, or explicitly block activation pending that unresolved behavior. Describing broader update propagation does not earn preservation credit. Missing folder and account bindings are explicit. It does not forward every metadata event without obtaining contents or use Azure managed-connector paths as native service URLs. Unsupported historical backfill, overwrite, and replay assumptions are identified rather than silently promised. Polling, webhook-assisted retrieval, or a supported component trigger can all pass.",
    },
  ],
  tests:
    "Exercise the registered copy path with non-UTF8 bytes and a filename containing spaces/non-ASCII characters, asserting exact destination bytes and filename. Include a source-content fetch failure and show it does not create a destination file containing metadata, an error, or empty replacement data. If the target accepts Azure trigger envelopes, exercise actual encoded-header conversion; if it uses native APIs, test that native boundary instead.",
  tags: ["logic-apps", "binary-content", "connector-boundaries", "focused"],
});
