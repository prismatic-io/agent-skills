import { defineComponentCase } from "../component-case.ts";

export default defineComponentCase({
  id: "files-com",
  service: "Files.com",
  request:
    "I need to build a low-code integration with files.com. Look up docs and build a custom connector I can use. I need a trigger that runs when a file is changed. I also need actions for uploading/downloading files, list files, creating folders, moving files, encrypting/decrypting files, etc.",
  persona: `You build integrations in Prismatic's low-code designer and do not write code.
You need a reusable Files.com connector. You do not know API endpoints, authentication
protocols, SDKs, or the difference between webhooks and polling. You want to react
when files are added or their contents change; a delay of a few minutes is acceptable.
You want to encrypt files for a partner and decrypt files they send you. You do not
have Files.com credentials or encryption keys available in this session. Publish
the connector to the authenticated Prismatic sandbox so I can use it in the low-code
designer. Do not change live Files.com accounts. You have no preferences about
code structure or libraries.`,
  operations: [
    "uploading file bytes",
    "downloading file bytes",
    "listing files",
    "creating folders",
    "moving files",
    "encrypting files",
    "decrypting files",
  ],
  trigger:
    "detect added files and changed file contents; either outbound webhooks or scheduled polling is acceptable, and polling must not be penalized",
  facts:
    "Files.com supports outbound HTTP webhooks for file activity through webhook behaviors (https://www.files.com/docs/automation-and-flow/notifications/webhooks). Claiming that Files.com only supports email notifications or has no outbound webhooks is false.",
  tests: [
    "exact non-text binary byte preservation in upload and download",
    "trigger behavior across repeated events or polls",
  ],
});
