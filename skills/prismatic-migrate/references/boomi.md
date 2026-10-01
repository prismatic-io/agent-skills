# Boomi source semantics

Use when reading Boomi process XML, component exports, or deployed-process configuration. Defaults below describe the linked Integration documentation; confirm the source's deployed version and overrides before depending on them.

## A process XML is not the deployment

The Component API returns one component's configuration XML at a selected ID/version; an unversioned GET returns the latest version. Connections, operations, profiles, maps, scripts, and processes are distinct component types. Resolve referenced IDs and versions before interpreting an empty-looking shape as a no-op. Password fields are masked, so an exported value is not a recoverable credential. [Component API](https://developer.boomi.com/docs/api/platformapi/Component)

A packaged process includes dependent components; its version is a useful boundary for reconstructing what actually ran. Obtain missing dependencies rather than reconstructing a map or connector operation from its label. [Packaged components](https://help.boomi.com/docs/Atomsphere/Integration/Deployment/int-Packaged_components_page_36b36378-4f73-4ad8-bac8-b72e87ceee93)

Deployment context can change behavior beyond component defaults. Environment extensions supply configurable values, while Disk v2 depends on the runtime's accessible filesystem, including mounted shares. Establish the effective values and filesystem access contract; replacing a local path with a remote file service is a design change requiring evidence. [Extensions](https://help.boomi.com/docs/Atomsphere/Integration/Process%20building/t-atm-Defining_process_extensions_f358055d-c38c-4b55-9a1b-9b68664213c5), [Disk v2](https://help.boomi.com/docs/Atomsphere/Integration/Connectors/int-Disk_v2_connector_d88d0ca9-b27e-44bd-ac32-dc1233e68123)

## Document scope, state, and concurrency

Custom processing scripts receive a document collection through `dataContext`. Initialization runs once per step execution; the script chooses which streams and properties to read and store. Calls to `storeStream` determine downstream document count. Preserve stream encoding, document properties, and output cardinality; translating the script as a function called once per JSON record can change all three. [Scripting context](https://help.boomi.com/docs/Atomsphere/Integration/Process%20building/c-atm-Scripting_context_b8489290-b3cd-4029-ae28-04961b23f3aa)

Persisted process properties are scoped per process and runtime, cloud, or runtime cluster. At a persisting Set Properties step the write happens immediately, even if later work fails. Concurrent writes use the last value set. This can make a property a partial-progress checkpoint rather than a success marker; inspect its write position and existing deployed value before choosing replacement state semantics. [Property persistence](https://help.boomi.com/docs/Atomsphere/Integration/Process%20building/c-atm-Process_Properties_persistence_b1bee14e-607f-4b80-94db-481a0b04f69d)

General execution mode defaults to simultaneous executions disabled; Bridge and Low Latency default to enabled. These are configurable defaults, not a global serialization guarantee. Inspect execution mode, simultaneous-execution setting, and any parallel Flow Control before reasoning about ordering or shared state. [Execution modes](https://help.boomi.com/docs/atomsphere/integration/process%20building/int-understanding_execution_modes_2bc11045-c4a1-4601-b6fa-b1f81301e3e9/)

## Failures are not all process failures

Try/Catch defaults to Document Errors; All Errors also catches process errors. Catch receives the original documents and properties. Process Call wait/abort settings affect whether child failures return to the parent and their error scope; an asynchronous child is not equivalent to an awaited call. Configured Try/Catch retries do not execute in Test Mode. Follow the configured error path and distinguish document rejection, process failure, and already-completed effects when validating replay. [Try/Catch](https://help.boomi.com/docs/atomsphere/integration/process%20building/r-atm-try_catch_shape_7b3dd8df-426e-4ed7-824a-40cc0b5dc68d/)
