import * as suite from "./_suite.ts";

export default suite.defineCase({
  prompt: suite.prompt(
    "Put Prismatic's integration marketplace in the Integrations section of Settings. It should feel like part of Acme Portal rather than a different product, including for customers who switch Acme Portal to dark mode. The platform team will provide our Prismatic signing key (PEM) as PRISMATIC_SIGNING_KEY and our organization ID as PRISMATIC_ORGANIZATION_ID. Our tenant IDs are the customer external IDs in Prismatic. Serve the embedded token from /api/prismatic/token.",
  ),
  persona:
    "The app's stylesheet is the source of truth for colors and type. You lack admin access to Prismatic's organization settings; a teammate will apply theme changes from your notes. Any signed-in user may open the Integrations section.",
  assertions: [
    {
      id: "theme-matching",
      type: "rubric",
      criteria:
        "The embedded marketplace follows Acme Portal's look through the SDK. The app's design evidence is client/styles.css (light: primary #4f46e5, link #4338ca, background #ffffff, surface #f4f4f5, text #18181b, radius 8px; dark under [data-theme=\"dark\"]: primary #818cf8, link #a5b4fc, background #18181b, surface #27272a, text #f4f4f5), the Inter Google font in client/index.html, and client/colorScheme.ts for the light or dark mode. Credit passing the app's current mode as the SDK theme; rendering the screen again with the new mode when the user toggles, without calling init again; loading Inter through init's fontConfiguration; and loading-screen colors that match the current mode's background and text or surface. Do not require a particular hook or component structure, and accept a reasonable choice between background and surface.",
    },
    {
      id: "theme-handoff",
      type: "rubric",
      criteria:
        "The handoff gives the teammate the organization theme values for both Embedded Light and Embedded Dark, traced to the app: at least primary, background, and link colors (light #4f46e5, #ffffff, #4338ca; dark #818cf8, #18181b, #a5b4fc) and an 8 px border radius, in hex or rgb(). It explains that brand colors belong in the Prismatic organization theme, apply to every customer, and were not changed. Credit extra fields such as neutral or secondary when grounded in the app; penalize invented colors or claims that the SDK can set brand colors.",
      evidence: { view: "execution" },
    },
  ],
});
