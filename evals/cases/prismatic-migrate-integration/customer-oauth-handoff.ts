import { resolve } from "node:path";
import { defineMigrationCase } from "../../migration-case.ts";

export default defineMigrationCase({
  id: "customer-oauth-handoff",
  fixture: resolve(
    import.meta.dirname,
    "../../fixtures/migrations/customer-oauth-handoff/input",
  ),
  deliverable: "assessment",
  request:
    "Support wants to move these pilot customers from our old CRM connector to Prismatic without making everyone reconnect. Review the packet and leave an operator-ready connection handoff plan and a short support update. We need to know what we can prepare now and what blocks the window. This is planning only; don't run a migration or contact any services.",
  persona:
    "You are Ava in support. You know the customer and change-window constraints, not OAuth internals or Prismatic API syntax. If asked, Cedar has agreed to be the first pilot and can tolerate a 30-minute pause; Juniper cannot tolerate a pause this week and may stay on the legacy connector; Maple's integration runs under the customer's service user but you do not know its target user ID. Keeping old customers on their current connector while piloting one customer is acceptable. You can supply these business facts when relevant, but cannot provide credentials, resource IDs, provider refresh/rotation policy, grant compatibility, deployment-hook verification, or live execution evidence. Do not invent technical facts or prescribe the migration design. A useful plan may state conditional alternatives when facts cannot be obtained this session.",
  sourceContract:
    "The packet is a non-secret operational worksheet, not an API export. Cedar has a paused existing version-7 instance with nondefault EU/archive/field-mapping config; target CRM account remains unverified. Juniper has version 6 and a staging OAuth app label instead of legacy production. Maple has no target instance and needs user-level connection identity. Display connection keys repeat across customers; no target resource IDs or tokens are supplied. Legacy schedules and refresh workers remain active, final token snapshot unavailable, provider grant compatibility and refresh-token rotation unknown. The incomplete ticket leaves resource identity, configuration preservation and refresh ownership unspecified; refreshAt is blank. Deployment hook registers an unreviewed webhook. Prismatic docs api/common-queries/updating-config-variables document deploying an instance then querying its config variables and importing OAuth tokens with updateOAuth2Connection using the instance config-variable ID; user-level OAuth uses updateUserLevelOAuth2Connection. refreshAt in the past forces immediate refresh. updateInstance with configVariables resets omitted values to defaults/null; updateInstanceConfigVariables updates a subset. creating-instances documents customer and published integration-version identity. instances/deploying allows customers on different integration versions. integrations/lifecycle documents deploy hooks with external effects. These documents establish platform possibilities, not that the unknown CRM grants are portable or valid.",
  criteria: [
    {
      id: "customer-and-connection-identity",
      criteria:
        "The plan reconciles customer, CRM account, target instance, published integration version and the actual scoped config-variable identity before token import. It distinguishes instance-level Cedar/Juniper from user-level Maple and does not use a repeated display key as a globally unique target ID. It addresses Juniper's app/version mismatch and Maple's missing instance/user identity with specific next evidence rather than inventing IDs. Different published versions can be valid for different customers; reconciliation does not mean that every customer must upgrade to the latest version. Cite evidence from the generated plan, not unchanged input records. Do not require literal GraphQL code or one document layout.",
    },
    {
      id: "configuration-survives",
      criteria:
        "The proposed operations do not reset unrelated customer configuration. Judge the actual operations proposed in the generated plan: a supported token-only import without a general config rewrite is acceptable and does not require a separate recitation of existing settings. If the plan proposes changing general config values, it must preserve unrelated settings through a supported subset update, complete preserved config set, or another documented mechanism. A broad replacement with only connection fields fails because existing customer choices would be lost. Unchanged input records show what exists, not what the plan promised to preserve; cite the plan's actual mutation or operational scope rather than inventing statements about individual settings. Omission of a configuration checklist alone is not a defect when the proposed path leaves that configuration untouched. If proposed write semantics cannot be determined from available evidence, abstain rather than assume either a destructive replacement or a safe partial update.",
    },
    {
      id: "credential-handoff-and-refresh",
      criteria:
        "The assessment identifies token import as a documented possible path to avoiding reauthorization, without promising all grants can migrate or demanding reconnect by default. It gates reuse on appropriate app/account/grant and expiry/scope/provider evidence. It recognizes that refreshAt in the past requests immediate refresh and that uncoordinated refresh ownership can matter when rotation policy is unknown; it must not assert this provider definitely rotates or never rotates. The handoff coordinates old job/refresh ownership, latest token capture and target validation without concurrent unreviewed writers, logging secrets, or asking support to paste tokens into the chat. Blind restoration of stale credentials is not a proven rollback.",
    },
    {
      id: "bounded-customer-rollout",
      criteria:
        "The runbook distinguishes preparation from an authorized live switch, gives customer-specific blockers/owners and supports a staged pilot instead of treating the list as one all-or-nothing migration. It accounts for the unreviewed deployment webhook hook rather than assuming a paused target makes configuration/deployment harmless. It calls for observable account/connection/refresh and integration behavior validation appropriate to a controlled window, and conditional rollback or reauthorization when grant reuse is unavailable. Support receives accurate expectations without an unsupported guarantee of zero downtime, no reconnects, or production readiness. Missing facts may be requested or handled through explicit conditional gates; asking a particular question is not required.",
    },
  ],
  tests:
    "For this planning request, evaluate whether the recommendations actually follow the customer packet and documented Prismatic operations. A concise decision table and executable-order runbook or equally clear prose are sufficient; no code, mock OAuth server, local test suite, secret access, or live platform execution is required. Any rehearsal must remain synthetic and must not be claimed as proof of grant validity or rollout readiness.",
  tags: ["customer-rollout", "oauth-handoff", "configuration", "assessment"],
});
