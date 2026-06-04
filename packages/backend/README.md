# @workspace/backend

Convex backend (EU West / Ireland deployment, project quantumlabs/blueprnt).

- Dev: `bun run dev` (convex dev). First-time setup: `bun run setup`.
- Auth schema regen: run the Better Auth CLI from `convex/betterAuth/` with
  `bunx @better-auth/cli@latest generate --output generatedSchema.ts --yes`.
  Only `generatedSchema.ts` is generated; custom indexes live in `schema.ts`.
- If file watching misbehaves during `convex dev`, set `CONVEX_TMPDIR` to a
  directory on the same filesystem as the repo (macOS: /tmp is a different
  filesystem than /Volumes).
- Deployment env vars: `BETTER_AUTH_SECRET`, `SITE_URL` (and later Scaleway
  TEM credentials). Set via `bunx convex env set`.
- No self-serve sign-up: `emailAndPassword.disableSignUp` is set in
  `convex/auth.ts`; accounts are provisioned by an admin (the dev seed
  today, the invitation flow later).
- Dev seed (creates a sign-in-able local account): `bunx convex run seed:seedDevUser`
  Credentials: `hej@blueprnt.se` / `abc123` (name "Hej"). Guard: only runs when `SITE_URL` contains `localhost`. Cleanup: `bunx convex run seed:removeDevUser '{"email":"hej@blueprnt.se"}'`.
- Dev workspace (admin membership for the seeded user): `bunx convex run seed:seedDevWorkspace`
  Creates workspace "blueprnt dev" (slug `blueprnt-dev`) with the seeded user as admin, plus the profile row and audit entries. Idempotent; same localhost guard.
- Email verification is disabled until the Scaleway TEM env vars
  (`SCW_SECRET_KEY`, `SCW_PROJECT_ID`, `SCW_REGION`, `EMAIL_FROM`) are set
  and the sending domain is verified. When configuring them, also flip
  `requireEmailVerification` to `true` in `convex/auth.ts`. Manual verify
  fallback: open the `emails` row in the Convex dashboard and visit
  `props.url`.
