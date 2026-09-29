# Source behavior and review limits

This is supplementary Paragon source-family coverage, not a replacement for the existing migration corpus. The source is a genuine small tutorial workflow, not a representative production workload or a runnable Paragon engine.

## Supported behavior and bounded probes

The workflow declares EndpointStep with a required STRING message, allowArbitraryPayload:false, no header/query validations, then Slack sendMessage, then a JSON ResponseStep statusCode 200. The send action maps the original message, selects channel parato-testing-ground, authenticatedUser:true, empty botName and placeholder botIcon. It sets autoRetry:false and continueWorkflowOnError:false. The HTTP 200 response has JSON body `{status: actionStep.output.result.ok}`: `status` is the literal JSON property name, separate from the HTTP status code. Its value is selected from the completed send, not a hard-coded true or an execution ID. defaultEnabled:false is deployment information, not permission to enable all users automatically. The integration-level channel input exists but this workflow does not reference it.

For any target, use its actual registered caller path with declared input/config adapters. Record the effective Slack request/action, response and invocation count. Do not mandate native components, raw HTTP, synchronous flow configuration or a specific connection scope mechanism.

1. Send a normal message and one containing leading/trailing spaces, line breaks and Slack-looking text (`  Review <@U_TEST>\nnext line  `). The message value should reach the chosen send boundary unchanged unless an explicit caller-visible change is proposed. No source transform establishes trimming, escaping or adding an attribution prefix. Preserve the declared connected-user sender intent; a generic shared bot is a material proposed change, not automatically equivalent. Local account doubles establish routing, not real OAuth ownership.
2. With a documented successful managed-action result, observe the selected ok value under the literal JSON property `status` at the registered caller/result boundary after the send completes. An undisclosed property rename changes the caller contract even when the boolean is correct. Do not mistake a helper return or queued execution ID for this result. Result envelope adapters must match the actual selected target action/API. The Paragon source expression identifies the result binding, not the hidden Slack wrapper implementation.
3. Missing or wrong-type message violates the declared trigger rule. Observe validation before a send, but do not invent exact hosted error status/body or the meaning of required for an empty string. allowArbitraryPayload:false is source configuration; extra-key rejection/stripping details are unresolved without the matching SDK contract.
4. A send failure must not take the ordinary response path and claim success. Probe a selected target operation's documented failure form; do not assume Paragon considers Slack HTTP 200/ok:false a thrown action error. If a managed step completes with result.ok:false, the source response expression selects false; whether that completion happens is unknown. The step requests no automatic retry and stops on error. Distinguish explicit target retries from undocumented connector-internal retries and caller retries. Exact hosted Paragon failure envelope is not established.
5. An accepted message followed by lost response is useful to inspect single-attempt behavior and truthful uncertainty. Source options do not establish exactly-once delivery or Slack idempotency. Do not demand an invented deduplication key, or accept “nothing was sent” solely from transport failure. No real message is needed for this local effect-boundary probe.

## Known unknowns and source limits

The pinned package lists @useparagon/core 1.1.16 and uses para build; @useparagon/integrations/slack is imported but absent from its dependencies/tree. Slack config imports three absent workflows. No project .para metadata, built-in OAuth credentials/scopes, connected-user records or caller implementation is supplied. Preserve these gaps rather than manufacturing a full local Paragon interpreter or dummy integrations and calling them a runtime oracle. Standalone source declaration tests can verify extracted graph/options/expressions, not host execution.

Official Request Trigger docs support input validation and custom synchronous responses; current docs describe a 55-second response deadline whose timeout does not mean the workflow failed. This is context, not proof of the older deployed runtime or a mandatory target timeout. Existing SDK/API documentation uses an authenticated Paragon user and requires enabled request workflows. Scope/auth and activation need an operator decision for target mapping. Source defaultEnabled:false does not prove current account enablement.

The literal tutorial channel is evidence, not an authorized real destination. Exposing a target channel setting or resolving a channel ID is reasonable if explained; do not demand the tutorial channel be deployed unchanged. No supplied caller code proves transport compatibility beyond message input and selected status output. Missing source dependencies justify a bounded port with explicit blockers, not silent-success stubs.

## Primary documentation

- https://docs.useparagon.com/paragraph/getting-started — exports/install, dashboard-only configuration omissions.
- https://docs.useparagon.com/paragraph/defining-workflows — step registration/orchestration.
- https://docs.useparagon.com/workflows/triggers/request-trigger — validation, response step and timeout distinction.
- https://docs.useparagon.com/workflows/auto-retries — retry feature; the source explicitly disables it on this action.
- https://docs.useparagon.com/apis/api-reference — authenticated workflow invocation/enablement.
- https://docs.useparagon.com/resources/integrations/slack — integration setup; not a substitute for the missing versioned generated implementation.
