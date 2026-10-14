import * as suite from "./_suite.ts";

export default suite.defineCase({
  fixtures: "../../fixtures/migrations/customer-oauth-handoff/input",
  prompt: suite.prompt(
    "Support wants to move these pilot customers from our old CRM connector to Prismatic without making everyone reconnect. Review the packet and leave an operator-ready connection handoff plan and a short support update. We need to know what we can prepare now and what blocks the window. This is planning only; don't run a migration or contact any services.",
    "assessment",
  ),
  persona:
    "You are Ava in support. You know the customer and change-window constraints, not OAuth internals or Prismatic API syntax. If asked, Cedar has agreed to be the first pilot and can tolerate a 30-minute pause; Juniper cannot tolerate a pause this week and may stay on the legacy connector; Maple's integration runs under the customer's service user but you do not know its target user ID. Keeping old customers on their current connector while piloting one customer is acceptable. You can supply these business facts when relevant, but cannot provide credentials, resource IDs, provider refresh/rotation policy, grant compatibility, deployment-hook verification, or live execution evidence. A useful plan may state conditional alternatives when facts cannot be obtained this session.",
  omitAssertions: ["local-checks"],
  assertions: [
    {
      type: "rubric",
      id: "customer-and-connection-identity",
      criteria:
        "The plan reconciles customer, CRM account, target instance, published integration version and the actual scoped config-variable identity before token import. It distinguishes instance-level Cedar/Juniper from user-level Maple and does not use a repeated display key as a globally unique target ID. It addresses Juniper's app/version mismatch and Maple's missing instance/user identity with specific next evidence rather than inventing IDs. Different published versions can be valid for different customers; reconciliation does not mean that every customer must upgrade to the latest version. Cite evidence from the generated plan, not unchanged input records. Do not require literal GraphQL code or one document layout. Cedar has a paused version-7 instance with target CRM account unverified; Juniper has version 6 and a staging OAuth app label. Maple has no target instance. Instance-level import uses updateOAuth2Connection with the deployed instance config-variable ID; user-level import uses updateUserLevelOAuth2Connection.",
    },
    {
      type: "rubric",
      id: "configuration-survives",
      criteria:
        "The proposed operations do not reset unrelated customer configuration. Judge the actual operations proposed in the generated plan: a supported token-only import without a general config rewrite is acceptable and does not require a separate recitation of existing settings. If the plan proposes changing general config values, it must preserve unrelated settings through a supported subset update, complete preserved config set, or another documented mechanism. A broad replacement with only connection fields fails because existing customer choices would be lost. Unchanged input records show what exists, not what the plan promised to preserve; cite the plan's actual mutation or operational scope rather than inventing statements about individual settings. Omission of a configuration checklist alone is not a defect when the proposed path leaves that configuration untouched. When the plan explicitly defers write semantics, credit its demonstrated preservation safeguards and deduct proportionally for any unresolved operator steps. Do not infer either a destructive replacement or a proven safe API choice. Abstain only when the plan or relevant evidence is unavailable, not merely because the observed plan is incomplete. Cedar has nondefault EU/archive/field-mapping settings. updateInstance with configVariables resets omitted values to defaults/null; updateInstanceConfigVariables updates a subset.",
    },
    {
      type: "rubric",
      id: "credential-handoff-and-refresh",
      criteria:
        "The assessment identifies token import as a documented possible path to avoiding reauthorization, without promising all grants can migrate or demanding reconnect by default. It gates reuse on appropriate app/account/grant and expiry/scope/provider evidence. It recognizes that refreshAt in the past requests immediate refresh and that uncoordinated refresh ownership can matter when rotation policy is unknown; it must not assert this provider definitely rotates or never rotates. The handoff coordinates old job/refresh ownership, latest token capture and target validation without concurrent unreviewed writers, logging secrets, or asking support to paste tokens into the chat. Blind restoration of stale credentials is not a proven rollback. Legacy schedules/refresh workers remain active; final token snapshot, grant compatibility and rotation behavior are unknown. refreshAt is blank in the ticket. Platform import capability does not prove these CRM grants portable or valid.",
    },
    {
      type: "rubric",
      id: "bounded-customer-rollout",
      criteria:
        "The runbook distinguishes preparation from an authorized live switch, gives customer-specific blockers/owners and supports a staged pilot instead of treating the list as one all-or-nothing migration. It accounts for the unreviewed deployment webhook hook rather than assuming a paused target makes configuration/deployment harmless. It calls for observable account/connection/refresh and integration behavior validation appropriate to a controlled window, and conditional rollback or reauthorization when grant reuse is unavailable. Support receives accurate expectations without an unsupported guarantee of zero downtime, no reconnects, or production readiness. Missing facts may be requested or handled through explicit conditional gates; asking a particular question is not required.",
    },
    suite.assessmentScope,
  ],
});
