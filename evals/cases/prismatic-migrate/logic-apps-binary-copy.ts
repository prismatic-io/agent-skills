import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/logic-apps-binary-copy/input",
  prompt: suite.prompt(
    "Move this Dropbox-to-OneDrive Logic Apps template to Prismatic. The important part is that newly created files arrive with their original bytes and usable filenames. Verify external-service behavior with mocked accounts, publish and import a fresh Prismatic review integration, and identify the folder and connection settings we still need to supply.",
  ),
  persona:
    "You own the file backup integration. Files can be binary and filenames can contain spaces or non-ASCII characters. The source is the supplied public template; it is not a fully configured account export. The Dropbox folder and both accounts' credentials will be provided at deployment.",
  assertions: [
    {
      type: "rubric",
      id: "file-content-and-name",
      criteria:
        "The registered target path copies actual new-file bytes into OneDrive's configured backup folder, preserving binary content and the intended filename. A source-content fetch failure must not create an empty, metadata or error replacement file. It does not serialize file metadata or a base64 wrapper as the file, decode binary through UTF-8, or silently double-encode/decode filenames. An implementation that obtains filename/content directly through documented native APIs can pass without emulating Azure trigger headers. A header-based translation must ground its encoding interpretation in the connector contract; disclose unsupported legacy encoding rather than invent it. Source destination is /backup from Dropbox. Its Create_file body is triggerBody() and filename is x-ms-file-name-encoded; the Dropbox trigger supplies bytes, not metadata. Encoding must follow https://learn.microsoft.com/en-us/connectors/dropbox/.",
    },
    {
      type: "rubric",
      id: "new-file-source-boundary",
      criteria:
        "The integration has a credible supported mechanism for identifying newly created files in a deployer-selected Dropbox folder and uses distinct Dropbox/OneDrive connection configuration. A change feed that also reports modifications is not a creation-only trigger: the implementation must distinguish newly created files from updates, or explicitly block activation pending that unresolved behavior. Describing broader update propagation does not earn preservation credit. Missing folder and account bindings are explicit. It does not forward every metadata event without obtaining contents or use Azure managed-connector paths as native service URLs. Unsupported historical backfill, overwrite, and replay assumptions are identified rather than silently promised. Polling, webhook-assisted retrieval, or a supported component trigger can all pass. The supplied trigger uses onnewfile every three minutes, with unbound folderId and connection references. No deletion policy is supplied.",
    },
  ],
});
