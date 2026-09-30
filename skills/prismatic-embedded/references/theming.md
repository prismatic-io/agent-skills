# Theming embedded screens

Use this note to make embedded screens look like the host app. Options and
their types are in the installed SDK's `dist/index.d.ts` and
[Theming](https://prismatic.io/docs/embed/theming/). Checked 2026-09-29 against
`@prismatic-io/embedded` 4.14.0.

## Find the app's design evidence

Read what the app already uses at runtime rather than inventing a palette: CSS
custom properties, Tailwind or component-library theme objects, design-token
files, font loading (Google Fonts links, `@fontsource`, `@font-face`), and the
dark-mode mechanism (`prefers-color-scheme`, a root class or data attribute, or
a stored preference). Record each value with the file it came from.

## What the SDK can set

The SDK sets only the mode, a Google font, and loading-screen colors; these
live in the app's code and change nothing in Prismatic.

- **Mode.** 4.14.0's `init` defaults `theme` to `"LIGHT"`, although the docs
  describe following the operating system, so pass the app's current mode. The
  mode is fixed when a screen renders: when the app's mode changes, call the
  screen method again with the new mode, not `init`, which clears the token.
  If the installed types accept `"AUTO"`, it applies each user's own
  appearance setting; use it when the app follows the operating system.
- **Font.** `fontConfiguration` accepts only Google Fonts, and only in `init`.
  For a self-hosted or licensed font, leave the default and say so.
- **Loading screen.** Match `screenConfiguration.initializing` to the app's
  surface and text colors so the loading state does not flash.

## What the organization theme holds

Brand colors, corner radius, and elevation belong to the organization's theme,
not the SDK. Its **Embedded Light** and **Embedded Dark** variants on the
organization's Theme tab apply to every customer, so change them only when the
user asks. Otherwise hand off, for each embedded variant, the app's values for
primary, background, link color, neutral (the base gray), any secondary or
accent colors, and the corner radius in pixels (0 to 100), each with its source
file. The theme accepts only hex or `rgb()` colors; convert others and say so.
If `prism --llms` lists theme commands, use them to read the current theme.
