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
