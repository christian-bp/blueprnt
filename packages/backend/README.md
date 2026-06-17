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
- Dev organization reset (removes all organizations for the seeded user to retest onboarding from step 1): `bunx convex run seed:removeDevOrganizations`
  Same localhost guard. Pass `'{"email":"..."}'` to target a different address.
- Dev organizations (admin membership for the seeded user): `bunx convex run seed:seedDevOrganization`
  Creates two fully onboarded organizations, "blueprnt" (slug `blueprnt`) and "Acme AB" (slug `acme-ab`), with the seeded user as admin in both: settings filled, a standard model, and onboarding marked complete, so the dashboard and the company switcher are ready out of the box. Idempotent; same localhost guard. `bun db:reset` already runs this; run it directly only to (re)seed companies without a full wipe.
- Full reset (from the repo root):
  - `bun db:reset` wipes everything, then re-seeds the dev user AND the two ready companies (sign-in lands on the dashboard).
  - `bun db:reset:onboarding` wipes everything, then re-seeds only the dev user (no company, sign-in starts the onboarding wizard from step 1).
  Stricter guard than the other seeds: `SITE_URL`'s hostname must BE `localhost` or `127.0.0.1`.
- Email verification is disabled until the Scaleway TEM env vars
  (`SCW_SECRET_KEY`, `SCW_PROJECT_ID`, `SCW_REGION`, `EMAIL_FROM`) are set
  and the sending domain is verified. When configuring them, also flip
  `requireEmailVerification` to `true` in `convex/auth.ts`. Manual verify
  fallback: open the `emails` row in the Convex dashboard and visit
  `props.url`.

## Before go-live

- **Remove `seed:seedProduction`** (and reassess every wipe-capable surface:
  `devReset.wipeAppTables`, `betterAuth/seed.wipeAuthData`). They exist for
  the demo phase; once real customer data exists there must be no admin
  action that can erase a production deployment in one call.
- Flip `requireEmailVerification` to `true` together with the Scaleway TEM
  env vars (see above).

## AI environment variables

The model-setup AI assistance (ADR-0003) calls Mistral La Plateforme directly
from Convex actions. Set on the deployment via `bunx convex env set`:

- `MISTRAL_API_KEY` (required for AI suggestions; with no key the actions
  degrade to the translated `errors.aiUnavailable` state and onboarding is
  never blocked)
- `MISTRAL_MODEL` (optional override, default `mistral-large-latest`)

Never route role data through Vercel AI Gateway: it cannot pin EU residency
(ADR-0001).
