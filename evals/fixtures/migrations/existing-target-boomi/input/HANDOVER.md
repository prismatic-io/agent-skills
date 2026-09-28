# Add order intake to the warehouse integration

The existing Prismatic project is `existing-integration/`. Warehouse callers
already depend on the Acknowledge Warehouse Receipt flow and its existing flow
identity. Their receipt prefix is configured per customer. The regression tests
describe that callback's response contract. Keep this flow and configuration
working while adding the Boomi order migration to the same integration.

The XML and Groovy files under `legacy/` are the Boomi material available this
week. No more component exports or live credentials can be obtained during this
work. Implement the supported order behavior locally and document unresolved
delivery or operational dependencies. This task does not authorize replacing
the integration with a separate project, publishing a version, or switching
traffic. The old warehouse callback and order intake are separate entry points.
