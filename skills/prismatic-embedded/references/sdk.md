# Browser SDK

Use this note when adding `@prismatic-io/embedded` to a frontend. For methods,
options, events, and custom marketplace UIs, read the installed package's
`dist/index.d.ts`, where each method has JSDoc and examples, and the
[embedding docs](https://prismatic.io/docs/embed/). This note covers behavior
those do not make obvious, verified against 4.14.0 on 2026-09-28; recheck on
other versions.

## Loading

Importing the module does not touch `window` or `document`, so
server-rendered files can import it. Its methods need the DOM: in Next.js and
other server-rendering frameworks, call them only from client components,
effects, or event handlers.

## Session lifecycle

- `init` must run before `authenticate`, and screen methods throw until
  authentication succeeds.
- Calling `init` again, or `dispose()`, resets the SDK's state, including the
  token, and `dispose` also removes its DOM. Do not pair a one-time `init`
  guard with `dispose` in component cleanup: React StrictMode's simulated
  unmount then leaves the SDK uninitialized. Run `init` once from module
  scope and reserve `dispose` for leaving embedding, such as sign-out.
- To refresh, call only `authenticate` with a new token, for example about 60
  seconds before `exp`. The rendered screen picks up the token; calling the
  screen method again reloads it. Only one embedded iframe receives refreshed
  tokens, so render one Prismatic screen per page. Clear the timer on unmount.
- Set `prismaticUrl` in `init` for another region or a white-label domain.

## Rendering

- A screen method with `selector` replaces that element's content with an
  iframe that fills it, so the element needs an explicit height. When the
  selector matches nothing, the SDK renders nothing and logs nothing; call it
  after the element is mounted. With no options, `showMarketplace` opens a
  popover.
- `showIntegrations` and `showDesigner` throw unless the embedded designer is
  enabled for the customer.

## Testing

Mock the module in frontend tests and assert the call order, the token passed
to `authenticate`, the refresh timer, and the error state.
