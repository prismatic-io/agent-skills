import { resolve } from "node:path";
import { defineMigrationCase } from "./_migration-case.ts";

export default defineMigrationCase({
  id: "bespoke-mime-extraction",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/bespoke-mime-extraction/input",
  ),
  request:
    "Move this Python message extraction into a callable Prismatic integration. Our caller will keep writing the extracted files; we need their names and exact bytes in order, including what was extracted before an error. The handover explains the new boundary. Build and verify it locally, and document how our caller invokes it and applies the result. No deployment or storage service work is needed.",
  persona:
    "You own the intake caller. Use legacy/OPERATIONS.md and the supplied source to answer questions; do not volunteer a test matrix or propose parser libraries. The caller owns destination writes and can handle a documented binary-safe representation and ordered items. Confirm the authorized differences in the handover if asked: writes may be delayed until the extraction result arrives, failed open/truncate-only files need not be returned, and local directory creation and literal traceback wording are not required. A failed extraction must still expose the successful prefix and an unsuccessful outcome. Trusted filename scope is in the handover. No additional filtering, naming or parsing changes are approved. You cannot invent undocumented MIME restrictions or promise live Prismatic response behavior. No accounts or credentials are available; let the agent choose an equivalent delivered architecture.",
  sourceContract:
    "The supplied complete Python CLI parses binary MIME with email.message_from_binary_file(policy=default), walks parts in order, skips parts whose content maintype is multipart, obtains filenames through get_filename, and generates part-NNN plus mimetypes extension or .bin when absent. The counter advances for every processed non-container part, including named parts. get_payload(decode=True) supplies written bytes; duplicate names replace earlier content. First failure stops traversal, retaining earlier writes. message/rfc822 may produce None payload and abort rather than extracting its inner message successfully. Authorized callable boundary projects successful extracted items in order plus complete/aborted outcome; failed open/truncate-only files and local-directory effects are excluded. Destination failures are caller-owned, not extraction failures. Filename domain and generated-name runtime limits are in OPERATIONS. No external storage API is supplied or required.",
  criteria: [
    {
      id: "mime-items-and-bytes",
      criteria:
        "The delivered registered callable path accepts complete message bytes without lossy conversion and preserves source part traversal, decoded bytes and names within the supplied trusted domain. Include unnamed non-container content and repeated names in order; a final map alone loses relevant replacement history. Do not restrict processing to attachment disposition, silently alter naming or claim universal mimetypes equivalence without evidence. Equivalent libraries and delivered caller processing are valid; no particular field names or parser package are required.",
    },
    {
      id: "partial-failure-and-caller",
      criteria:
        "A genuine extraction failure yields an explicit unsuccessful outcome with the previously successful ordered items, rather than skipping the failure or returning clean success. Respect authorized exclusion of failed open/truncate-only destinations and caller-owned write failures. Deliver a usable invocation and result-processing contract that exposes complete results and partial-error outcomes to the actual caller; detached helper data alone does not establish hosted delivery. Accurately distinguish exercised local registered behavior, documented platform behavior and unresolved live delivery. Do not add storage or deployment work.",
    },
  ],
  tests:
    "Compare registered extraction with the supplied source on ordinary and nested MIME, transfer-encoded binary content, unnamed and repeated filenames, and a consequential extraction failure after earlier successful content. Check ordered complete bytes and unsuccessful prefix results, not only helper values. Runtime-derived alternatives are valid; do not require a fixed hidden packet inventory or source filesystem failures outside the authorized extraction boundary.",
  tags: ["bespoke", "python", "mime", "binary", "partial-results"],
});
