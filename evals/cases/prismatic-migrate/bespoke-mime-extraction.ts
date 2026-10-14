import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/bespoke-mime-extraction/input",
  prompt: suite.prompt(
    "Move this Python message extraction into a callable Prismatic integration. Our caller will keep writing the extracted files; we need their names and exact bytes in order, including what was extracted before an error. The handover explains the new boundary. Build and verify it locally, and document how our caller invokes it and applies the result. Leave customer deployment and storage service work to our team.",
  ),
  persona:
    "You own the intake caller. The supplied source and legacy/OPERATIONS.md describe the contract. The caller owns destination writes and can handle a documented binary-safe representation and ordered items. Confirm the authorized differences in the handover if asked: writes may be delayed until the extraction result arrives, failed open/truncate-only files need not be returned, and local directory creation and literal traceback wording are not required. A failed extraction must still expose the successful prefix and an unsuccessful outcome. Trusted filename scope is in the handover. No additional filtering, naming or parsing changes are approved. You cannot invent undocumented MIME restrictions or promise live Prismatic response behavior. No accounts or credentials are available.",
  assertions: [
    {
      type: "rubric",
      id: "mime-items-and-bytes",
      criteria:
        "The delivered registered callable path accepts complete message bytes without lossy conversion and preserves source part traversal, decoded bytes and names within the supplied trusted domain. Include unnamed non-container content and repeated names in order; a final map alone loses relevant replacement history. Do not restrict processing to attachment disposition, silently alter naming or claim universal mimetypes equivalence without evidence. Equivalent libraries and delivered caller processing are valid; no particular field names or parser package are required. Source uses email.message_from_binary_file(policy=default), walks in order and skips multipart-maintype containers. get_filename supplies names; absent names use part-NNN plus the runtime mimetypes extension or .bin. The counter advances for every processed non-container part, including named ones; get_payload(decode=True) supplies bytes. Duplicate names replace earlier content when the caller applies the ordered items.",
    },
    {
      type: "rubric",
      id: "partial-failure-and-caller",
      criteria:
        "A genuine extraction failure yields an explicit unsuccessful outcome with the previously successful ordered items, rather than skipping the failure or returning clean success. Respect authorized exclusion of failed open/truncate-only destinations and caller-owned write failures. Deliver a usable invocation and result-processing contract that exposes complete results and partial-error outcomes to the actual caller; detached helper data alone does not establish hosted delivery. Accurately distinguish exercised local registered behavior, documented platform behavior and unresolved live delivery. Do not add storage or deployment work. The first extraction failure stops traversal; message/rfc822 may produce a None payload and abort instead of successfully extracting its inner message. Local-directory effects are outside the authorized callable boundary.",
    },
  ],
});
