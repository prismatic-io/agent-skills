# Additional migration sources

Use the matching section to locate source artifacts and consequential gaps.
These notes describe export boundaries, not complete runtime specifications.
Follow the source's actual operations, versions, and deployment configuration
into the linked documentation when behavior matters to the port.

## n8n

Workflows can be downloaded as JSON; clipboard content can represent only selected
nodes. Workflow JSON includes credential names and IDs, which do not establish a
portable authenticated connection. HTTP Request nodes imported from cURL can also
contain literal authentication headers. Inspect the actual file before treating
it as either complete or free of secrets.

The newer `.n8np` package format carries additional workflow references and project
structure, but is documented as Preview. Distinguish it from a single workflow
JSON and consult the installed version's package documentation. Neither a file
extension nor successful parsing establishes execution ordering, node behavior,
or the deployed configuration. [Export formats and options](https://docs.n8n.io/build/manage-workflows/export-and-import.md).

## Node-RED

Editor JSON exports can contain selected nodes, one flow, or the full flow
configuration. Resolve config nodes, subflows, and installed node implementations
that the supplied selection depends on. Properties declared as node credentials
are stored separately and omitted from editor exports; a flow file alone does not
recover them. [Export scope](https://nodered.org/docs/user-guide/editor/workspace/import-export),
[credential storage](https://nodered.org/docs/creating-nodes/credentials).

Context has node, flow, and global scopes. Memory storage is the default; a restart
clears it. `settings.js` can configure filesystem, custom, or multiple stores, and
calls can select a store. The default filesystem store caches writes and flushes
every 30 seconds. A `flow.set` call therefore does not by itself establish either
immediate durability or persistence across restart. Inspect store configuration
and the current state when replacing checkpoints or shared coordination.
[Context and storage](https://nodered.org/docs/user-guide/context).

## MuleSoft

A Mule project may arrive as a source directory or packaged application. A
shareable JAR contains source configuration XML, resources, `mule-artifact.json`,
and `pom.xml`, but excludes runtime libraries. A deployable JAR contains compiled
code and dependencies; including project sources is optional. Inspect archive
contents rather than inferring source completeness from `.jar`.

Use the POM and artifact configuration to establish dependency and runtime
versions, then follow referenced transformations, scripts, and configuration
resources. A missing source tree in a deployable archive is an evidence gap, not
permission to reconstruct behavior from flow names.
[Packaging options](https://docs.mulesoft.com/anypoint-code-builder/int-export-mule-project),
[Studio project imports](https://docs.mulesoft.com/studio/import-export-packages).

## Make

A scenario blueprint is JSON containing modules, module settings, and mapped
values. The import procedure separately configures account connections and
scheduling; a blueprint is not proof that either has been recovered for the target.
Inspect actual module versions, mappings, routes, and referenced resources, then
research their execution and error-handling contracts where relevant. The
blueprint guide does not establish one universal runtime contract for every
module. [Blueprint contents and import](https://help.make.com/blueprints).

## Tray

Tray exports individual workflows or projects as JSON. Project exports cover
definitions and structure, including supported tables, but omit stored table data,
APIM policies and roles, and linked agent subproject relationships. UI/CLI and
public Projects/Solutions APIs also differ in which asset types they move. A
workflow-only export can leave project configuration and other dependencies
unresolved.

Distinguish a saved project version from an export of current state, which can
include unsaved changes. Establish which one matches the deployed system and
resolve authentication mappings separately. These export semantics do not
establish connector operation behavior or recovery guarantees.
[Project and workflow export boundaries](https://tray.ai/documentation/platform/enterprise-core/lifecycle-management/import-export).

## Zapier

The documented Team/Enterprise export produces JSON. Ordinary users can export
their own Zaps; account owners and super admins can export across users. Account
scope therefore matters when interpreting an apparently complete export. Imported
Zaps still need activation and connection checks.

The export guide does not specify a stable, complete execution schema. Inspect
the actual artifact and research its trigger, action, filter, path, and code-step
contracts instead of imposing an invented normalized graph. Where account or plan
access prevents export, supplied definitions and execution evidence can still
support bounded migration work.
[Export access and limitations](https://help.zapier.com/hc/en-us/articles/8496308481933-Import-and-export-Zap-workflows-in-your-Team-or-Enterprise-account).

## Unlisted vendors and bespoke systems

These sources are not an allowlist. For other systems, use their native evidence:
code and dependencies, scheduler or worker configuration, service contracts,
deployed settings, and observed execution. Vendor defaults apply only after the
relevant runtime is established. A bespoke queue consumer or cron script need not
fit any of the formats above.
