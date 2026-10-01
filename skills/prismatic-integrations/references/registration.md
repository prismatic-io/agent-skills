# Trigger and lifecycle registration

Use this note when adding lifecycle hooks or changing a flow's trigger design.

The [CNI flow docs](https://prismatic.io/docs/integrations/code-native/flows/)
allow an omitted `onTrigger` for the implicit generic webhook. This does not
establish that every combination of flow options can use that default.
Spectral 10.30.3 wraps triggers when lifecycle hooks are present; an implicit
webhook plus those hooks can throw `Invalid trigger configuration` when the
integration module loads, even though TypeScript and the bundle build succeed.

Check the installed SDK's supported trigger shape. For a custom webhook flow,
an explicit pass-through `onTrigger` returning `{ payload }` is one documented
option; preserve any required response, verification, or payload transformation.
A supported component trigger reference is another option. The SDK's polling
trigger type requires a supported `onTrigger` and a schedule; ordinary scheduled
flows are also valid. Do not replace polling or a
provider-managed trigger with a pass-through just to make registration succeed.

[Lifecycle hooks](https://prismatic.io/docs/integrations/lifecycle/) have different
purposes: webhook lifecycle handlers also run around designer listening sessions,
whereas instance lifecycle hooks manage deployment resources. Choose by the
resource's lifetime, then load the whole compiled integration through the local
entry convention supported by the installed Prism version. Do not invoke hooks
against live services. When editing, compare the unchanged baseline under the
same dependencies before attributing a new load error to the SDK or environment.

Verified with Spectral 10.30.3. Recheck on other versions; the installed
`@prismatic-io/spectral/dist/serverTypes/convertIntegration.js` functions
`flowUsesWrapperTrigger` and `validateTriggerPerformConfig` explain this boundary.
This is a registration check, not proof of the flow's business behavior.
