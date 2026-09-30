import { embeddedMarketplace, tokenDesign } from "./_criteria.ts";
import { defineEmbeddedCase, fixtures } from "./_embedded-case.ts";

export default defineEmbeddedCase({
  id: "match-app-theme",
  fixture: fixtures.acmePortal,
  tokenPath: "/api/prismatic/token",
  request:
    "Put Prismatic's integration marketplace in the Integrations section of Settings. It should feel like part of Acme Portal rather than a different product, including for customers who switch Acme Portal to dark mode. The platform team will provide our Prismatic signing key (PEM) as PRISMATIC_SIGNING_KEY and our organization ID as PRISMATIC_ORGANIZATION_ID. Our tenant IDs are the customer external IDs in Prismatic. Serve the embedded token from /api/prismatic/token.",
  persona:
    "You are the product engineer who owns Acme Portal. The design system in the app's stylesheet is the source of truth for colors and type. You don't have admin access to Prismatic's organization settings; a teammate who does will apply any theme changes from your notes. Any signed-in user may open the Integrations section. You have no library or structure preferences.",
  criteria: [
    {
      id: "theme-matching",
      criteria:
        "The embedded marketplace follows Acme Portal's look through the SDK. The app's design evidence is client/styles.css (light: primary #4f46e5, link #4338ca, background #ffffff, surface #f4f4f5, text #18181b, radius 8px; dark under [data-theme=\"dark\"]: primary #818cf8, link #a5b4fc, background #18181b, surface #27272a, text #f4f4f5), the Inter Google font in client/index.html, and client/colorScheme.ts for the light or dark mode. Credit passing the app's current mode as the SDK theme; rendering the screen again with the new mode when the user toggles, without calling init again; loading Inter through init's fontConfiguration; and loading-screen colors that match the current mode's background and text or surface. Do not require a particular hook or component structure, and accept a reasonable choice between background and surface.",
    },
    {
      id: "theme-handoff",
      // The organization theme values arrive in the agent's final message.
      interaction: true,
      criteria:
        "The handoff gives the teammate the organization theme values for both Embedded Light and Embedded Dark, traced to the app: at least primary, background, and link colors (light #4f46e5, #ffffff, #4338ca; dark #818cf8, #18181b, #a5b4fc) and an 8 px border radius, in hex or rgb(). It explains that brand colors belong in the Prismatic organization theme, apply to every customer, and were not changed. Credit extra fields such as neutral or secondary when grounded in the app; penalize invented colors or claims that the SDK can set brand colors.",
    },
    embeddedMarketplace,
    tokenDesign,
  ],
  validation:
    "the token verifies with a generated key pair and carries the session's user and tenant; unauthenticated requests are rejected; browser-supplied identity values are ignored; a mocked SDK receives the current mode, the Inter font, and loading colors, and a mode toggle renders the screen again without calling init.",
  tags: ["marketplace", "theming", "dark-mode"],
});
