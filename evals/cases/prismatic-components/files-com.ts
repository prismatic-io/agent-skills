import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "I need to build a low-code integration with files.com. Look up docs and build a custom connector I can use. I need a trigger when a file is added or its contents change. I also need actions for uploading/downloading files, list files, creating folders, moving files, encrypting/decrypting files, etc.",
  ),
  persona:
    "You use the low-code designer and do not write code. A delay of a few minutes for file events is acceptable. You encrypt files for a partner and decrypt files they send you. No Files.com credentials or encryption keys are available this session.",

  assertions: [
    {
      ...suite.operations,
      criteria:
        "uploading file bytes; downloading file bytes; listing files; creating folders; moving files; encrypting files; decrypting files",
    },
    {
      ...suite.trigger,
      criteria:
        "detect added files and changed file contents; either outbound webhooks or scheduled polling is acceptable, and polling must not be penalized. Relevant Files.com trigger contracts, not an exhaustive API specification. Apply only the chosen mechanism; webhooks and polling are alternatives, not cumulative requirements. Webhook authentication alternatives are valid too: Files.com supports custom headers (webhook value.headers in the OpenAPI and Custom Headers in the webhook docs). A documented provider-side custom secret header checked against a required matching secret is legitimate shared-secret authentication, not an invented native signature protocol; native payload signing is not required by the request. For native signatures: the current official OpenAPI at https://app.files.com/api/rest/v1/swagger_doc.json documents X-Files-Signature-V2 as lowercase hexadecimal HMAC-SHA256 keyed by verification_token over the exact POST body (or exact GET query string without the leading question mark). V2 is valid and recommended; do not label it invented or require an MD5 fallback. Legacy standard RAW/XML/JSON verification uses x-files-signature containing MD5(verification token + file path without a leading slash). Match the selected header to its documented algorithm and input. A configured signed-only trigger must reject missing or invalid verification state/signatures rather than fail open. Unsigned webhook delivery is also valid for this request; do not penalize a trigger solely because verification was not configured. EV1/EV2 legacy verification uses x-exavault-signature containing MD5(verification token + raw request body), as documented at https://www.files.com/docs/automation-and-flow/notifications/webhooks/legacy-format-webhooks . Requiring signed webhooks and a nonblank token is valid; unsigned webhook support is not required. If unsigned mode is supported, a blank configured token means no signature is sent. See https://www.files.com/docs/automation-and-flow/notifications/webhooks . For polling, a supported folder-listing snapshot/diff or folder-history mechanism is acceptable; History is not mandatory. The official OpenAPI documents GET /folders/{path} pagination using the cursor parameter from X-Files-Cursor-Next (not X-Files-Cursor). Listed FileEntity records expose server modification time as mtime, not modified_at; crc32 and md5 checksums may be temporarily unavailable. Assess change detection against documented metadata availability, allowing service-side delays rather than requiring immediate detection. History-specific facts apply only if that mechanism is used: GET /history/folders/{path} is paginated: follow the X-Files-Cursor-Next response header using the cursor parameter, or verified equivalent pagination, before advancing a checkpoint past unseen changes. Do not assume an undocumented default sort order. Recent history covers the preceding 24 hours, so polling setup must account for retention. See https://github.com/Files-com/files-sdk-javascript/blob/master/lib/models/History.js and https://developers.files.com/javascript/resources/logging/actions/ .",
    },
    {
      ...suite.accuracy,
      criteria:
        "Files.com supports outbound HTTP webhooks for file activity through webhook behaviors (https://www.files.com/docs/automation-and-flow/notifications/webhooks). Claiming that Files.com only supports email notifications or has no outbound webhooks is false.",
    },
  ],
});
