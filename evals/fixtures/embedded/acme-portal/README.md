# Acme Portal

The customer portal for Acme's project-tracking product. Each tenant is one of
our customers; users sign in and see only their tenant's data.

- `server/` is an Express 5 API. Sessions are in memory and use an HTTP-only
  `sid` cookie. `requireUser` loads the signed-in user and tenant.
- `client/` is a React app built with Vite. It calls the API with
  `credentials: "include"`.

Run `npm install`, then `npm run dev`. `createApp()` in `server/app.ts` builds
the API with no arguments and reads configuration from environment variables;
see `.env.example` and `server/config.ts`. Demo users are in
`server/data.ts`.
