# Design: Convex backend + Better Auth (Fas 1 foundation)

Status: approved design, pending implementation plan.
Date: 2026-06-04.
Scope decided with the founder: one design covering `packages/backend` and Better Auth together, built in phases (backend scaffold first, auth second). Minimal `apps/dashboard` shell. Email invitations included, via Scaleway TEM.

Grounding: `docs/PLAN-V1.md` (Fas 1, E1), ADR-0001 (Convex EU + Better Auth), ADR-0002 (live recompute, derived score/band), ADR-0003 (AI outside the deterministic core), glossaries in `docs/contexts/`. All load-bearing platform claims below were verified against current official documentation (June 2026) with adversarial fact-checking; see References.

## 1. Goals

A production-grade foundation so later slices (model configuration, assessment, results) only add tables and functions, never rearchitect:

1. `packages/backend`: Convex deployment in the EU with the full V1 schema skeleton, org-scoped function boundary, audit log, and durable email outbox.
2. Better Auth with the organization plugin: organization = workspace (tenant), member roles Admin and Editor, email/password sign-in, email invitations.
3. `packages/core` skeleton: the fixed importance scale and domain types (engine functions come in Fas 2).
4. `packages/email`: React Email templates with locale-aware rendering.
5. `apps/dashboard` minimal shell proving auth end to end.
6. Tests on everything from the start; all tests run in the pre-commit hook.

## 2. Versions (verified June 2026)

| Package | Version | Constraint source |
| --- | --- | --- |
| `convex` | `^1.35` | current stable; >= 1.25 required by the auth component |
| `@convex-dev/better-auth` | `0.12.2` | current `latest` |
| `better-auth` | `1.6.14` | peer range `>=1.6.9 <1.7.0`; never bump to 1.7.x until the component does |
| `convex-helpers` | pin current at implementation | custom functions API verified stable |
| `convex-test` | `0.0.53` | requires Vitest, not bun test |
| `vitest` | `^4.1` | Vitest 4 line; needs Node >= 20 |
| `@edge-runtime/vm` | `^5.0` | env for convex-test |
| `@vitest/coverage-v8` | `^4.1` | default provider |
| `@testing-library/react` | `^16.3` | React 19 compatible |
| `react-email` / `@react-email/components` | pin current at implementation | render verified to run inside Convex |

## 3. Architecture: packages and deployment

New workspace packages (existing convention `@workspace/*`):

```
apps/dashboard            Product app shell: Next 16 + Convex client + Better Auth   NEW (minimal)
packages/backend          Convex deployment: schema + functions, EU region           NEW
packages/core             Pure deterministic engine + domain types                   NEW (skeleton)
packages/email            React Email templates, locale-aware rendering              NEW
packages/vitest-config    Shared Vitest presets                                      NEW
```

### packages/backend

Follows the official Convex Turborepo template shape: `convex/` at the package root, `convex dev` runs from the package (persistent task in `turbo dev`), consumers deep-import generated types (`@workspace/backend/convex/_generated/api`) and add `transpilePackages: ['@workspace/backend']` in the consuming Next config. `_generated/` is committed (required for typecheck) and excluded from Biome.

```
packages/backend/convex/
  schema.ts           composes tables from all contexts
  convex.config.ts    mounts the local betterAuth component
  auth.ts             createClient, createAuth options, triggers wiring
  auth.config.ts      JWT identity provider (getAuthConfigProvider)
  http.ts             authComponent.registerRoutes(http, createAuth)
  betterAuth/         Local Install component: generated schema, our membership
                      query, regen-safe custom indexes
  accounts/           workspaceProfile, members, workspace creation
  evaluationModel/    criteria, anchors, thresholds, tracks (tables now, functions Fas 2)
  assessment/         roles, ratings (tables now, functions Fas 3)
  email/              outbox table functions + Scaleway TEM sender action + cleanup cron
  lib/                org-scoping wrappers, error codes, audit helper
```

### packages/core

Scaffolded with what this slice needs: `IMPORTANCE_SCALE` (the fixed 7-level scale mapping to weights 8, 10, 11, 12, 13, 14, 18; level 7 = highest = weight 18), domain types (Track, Level, Band, Criterion, Rating), unit tests. Engine functions (`scoreRole`, `assignBand`, `computeResults`, `checkGuardrails`) arrive in the Fas 2/E4 slice. Invariants: zero dependencies, no Convex/Next imports (ADR-0002). Verified: pure workspace TS packages bundle cleanly into Convex functions.

### apps/dashboard (minimal shell)

Next 16 like `apps/web` (`proxy.ts` with explicit function export). No locale in the URL; language becomes an account setting later (PLAN-V1 paragraph 7). Contents: auth catch-all route `app/api/auth/[...all]/route.ts` (re-exports the handler from `convexBetterAuthNextJs`), `ConvexBetterAuthProvider`, bare sign-in/sign-up page, accept-invitation page at `/accept-invitation/[id]`. All copy through `@workspace/i18n` keys: added to `en.json` first, mirrored to sv, nb, da, fi.

Auth state gating uses Convex's `useConvexAuth()` / `<Authenticated>` components, not Better Auth's `useSession` (Better Auth reports authenticated before Convex validates the token).

### Deployment topology (the irreversible part)

- Region is chosen per deployment and can never be changed. Before anything is provisioned: set the Convex team default region to EU West (Ireland) in the dashboard. Then create the project. Verify each developer's cloud dev deployment region once.
- EU deployments are billed on demand only (no included quotas) at roughly 30 percent higher resource pricing. Accepted under ADR-0001.
- CLI region selection is not reliably documented; provision via the dashboard.
- Deployment env vars: `BETTER_AUTH_SECRET`, `SITE_URL`, Scaleway TEM credentials. Dashboard app env: `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, `NEXT_PUBLIC_SITE_URL`, `CONVEX_DEPLOYMENT`.

## 4. Auth design

### Local Install from day one

The organization plugin is not in the component's supported-out-of-the-box list, so we own the auth component in-repo (verified, including maintainer statements):

- `convex/betterAuth/` is its own component (`defineComponent('betterAuth')`), mounted from `convex/convex.config.ts`.
- The auth schema is generated by the Better Auth CLI (`npx auth generate` inside `convex/betterAuth/`). Generated files are never hand-edited; regeneration overwrites them.
- Custom indexes live in a separate file spread into the schema so they survive regeneration. We restore the `member` index `[organizationId, userId]` there (the current CLI drops it; open bug get-convex/better-auth#157).
- Adapter functions are exported via `createApi`; the client is `createClient<DataModel, typeof authSchema>(components.betterAuth, { local: { schema: authSchema } })`.

### Sign-in and roles

- V1 sign-in: email + password with email verification and password reset (both email through the outbox). SSO/social later; SSO is explicitly incompatible with the component today.
- Organization = workspace (glossary: Arbetsyta). Custom roles via `createAccessControl`: exactly `admin` and `editor`. `admin` is the owner-equivalent (full control, member management, later model configuration); `creatorRole: 'admin'`. `editor` gets role/rating permissions only. Permission statements are defined now so later slices consume them.
- Org id is an explicit validated argument on every org-scoped function. No hidden active-organization session state in the function contract.

### Org scoping (approach A, chosen)

Tenancy truth lives in exactly one place: the component's `member` table.

- `convex/betterAuth/membership.ts`: a small query inside the component reading `member` via the restored index, with a return validator (cross-component calls require one).
- `convex/lib/functions.ts`: `orgQuery`, `orgMutation`, `adminMutation` builders from `convex-helpers` custom functions (`customQuery`, `customMutation`, `customCtx`). The wrapper resolves identity from the JWT (`ctx.auth.getUserIdentity()`), checks membership through the component query, throws `ConvexError({ code })` on failure, and injects `ctx.orgId`, `ctx.role`, `ctx.user`. The wrapper deliberately avoids `getAuthUser()`'s adapter path; that is also what makes it testable under convex-test (the adapter path fails there, open issue get-convex/better-auth#235).

Rejected alternatives: B (mirror memberships into app tables via triggers; dual truth in the security path, partial-commit semantics) and C (Better Auth permission API per function; not query-safe everywhere, slow, hard to test). B remains a documented escape hatch if the component round-trip ever becomes a measured problem.

### Users mirror and workspace profile

- Triggers (verified: typed per-table for any table in the auth schema) maintain a thin app-side `users` table on `user.onCreate/onUpdate/onDelete`, in the same transaction as the auth write. This holds the future per-account language setting and gives the audit log an app-side join target.
- A trigger on `organization.onCreate` idempotently seeds an empty `workspaceProfiles` row. The company-setup form that fills it is a later slice.
- Trigger caveat (verified): no cross-operation atomicity within one Better Auth endpoint; trigger logic must be idempotent.

### Invitations

Better Auth's standard invite flow with `sendInvitationEmail`. The callback runs inside the Convex HTTP action handling the auth request; it enqueues into the email outbox via `ctx.runMutation` (never blocks the auth request on a third-party call). Accept link: `${SITE_URL}/accept-invitation/${invitationId}`, handled by the dashboard shell. Invite emails render in the workspace language (from `workspaceProfiles`, fallback `en`).

## 5. Email architecture

Better Auth sends no email itself; the callbacks are ours. Provider decision: Scaleway TEM (EU-sovereign, French-owned, data in France; 300 free emails/month covers V1 volume). Resend was rejected after verification: Resend stores all account data, email metadata, and logs in the US regardless of its eu-west-1 sending region, which fails ADR-0001 even under the lenient physically-in-EU reading. Scaleway enters the subprocessor/DPA list as an EU entry.

### packages/email (pure)

- React Email templates as typed components: `InvitationEmail`, `VerifyEmail`, `ResetPasswordEmail` (more later: reports, notifications).
- `renderEmail(templateKey, props, locale)` returns `{ subject, html, text }`. Strings come from `@workspace/i18n` message files under `email.*` keys (plain JSON imports; no next-intl runtime in the backend). The official Better Auth + Convex example renders React Email inside Convex, so this is the supported path.
- Purity rule like `packages/core`: no provider code, no Convex imports. Snapshot tests per template and locale; React Email `email dev` preview server for design work.

### Durable outbox in packages/backend

Same shape as the official Resend component (durable queue, retries, idempotency, cleanup), provider-agnostic:

- `emails` table: `{ to, templateKey, props, locale, status: queued|sending|sent|failed, attempts, providerMessageId?, lastError? }`, index `by_status`.
- `enqueueEmail` internal mutation: transactional with whatever triggered it (an invite that commits always has its email row committed with it).
- Sender internal action: renders via `@workspace/email`, POSTs to the Scaleway TEM REST API with `AbortSignal.timeout`, marks status, retries with scheduler backoff (max 3 attempts), uses the row id as idempotency reference.
- Cleanup cron deletes `sent`/`failed` rows after 30 days (outbox rows carry recipient PII; data minimization).

Swapping or adding an ESP later touches only the sender action. Trade-off accepted: we own roughly 150 lines of outbox logic because the maintained component is Resend-only.

## 6. Data model (full V1 schema skeleton)

Tables are pushed now; functions arrive in their phases. All tenant tables carry `orgId: v.string()` (Better Auth organization id; a string reference because the org lives in the auth component) and an index starting with `orgId`. Score and band are stored nowhere; they are always derived (ADR-0002).

Auth component (generated, in `convex/betterAuth/`): `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, plus the regen-safe custom index `member [organizationId, userId]`.

### accounts (app side)

| Table | Fields | Indexes |
| --- | --- | --- |
| `users` | `authId`, `name`, `email`, `locale?` (mirror via triggers) | `by_auth_id` |
| `workspaceProfiles` | `orgId`, `country?`, `currency?`, `language?`, `employeeCount?`, `businessType?` | `by_org` |

### evaluationModel

| Table | Fields | Indexes |
| --- | --- | --- |
| `models` | `orgId`, `name`, `templateKey?` (provenance) | `by_org` |
| `criteria` | `orgId`, `modelId`, `name`, `description`, `helpText`, `importanceLevel` (1-7), `order`, `isCustom`, rationale group (`purpose?`, `whyRelevant?`, `overlapNotes?`), bias group (`biasRisk?` low/medium/high, `biasComment?`, `biasAction?`, `approved?`, `decidedBy?`, `decidedAt?`) | `by_model`, `by_org` |
| `criterionAnchors` | `criterionId`, `level` (0-5), `text` | `by_criterion` |
| `tracks` | `orgId`, `modelId`, `key` (IC/Lead/M), `name`, `order` | `by_model` |
| `levels` | `trackId`, `key` (IC1..M3), `name`, `definition?`, `order` | `by_track` |
| `trackGuardrails` | `orgId`, `levelId`, `criterionId`, `min`, `max` (advisory) | `by_level` |
| `bandThresholds` | `orgId`, `modelId`, `band` (1-7, Band 1 highest), `minScore` | `by_model` |

The importance scale is not a table; it is the fixed constant in `packages/core`. Weights never appear in any `returns` validator; clients only see `importanceLevel`.

### assessment

| Table | Fields | Indexes |
| --- | --- | --- |
| `roles` | `orgId`, job profile core (`name`, `function`, `team`, `trackId`, `levelId`, `purpose`, `responsibilities`), optional structured fields (`decisionMandate?`, `stakeholders?`, `knowledge?`, `financial?`, `people?`, `risk?`, `deliverables?`), `status` (draft/inReview/approved), `archivedAt?` | `by_org`, `by_org_status` |
| `ratings` | `orgId`, `roleId`, `criterionId`, `value` (0-5), `motivation?` | `by_role_criterion` (uniqueness enforced in the mutation), `by_org` |

Role identity policy (V2 seam, PLAN-V1 paragraph 11): role ids are permanent. No hard delete once a role has ratings or is approved; archiving sets `archivedAt`. Role/rating tables never carry person, salary, or performance fields.

### Cross-cutting

| Table | Fields | Indexes |
| --- | --- | --- |
| `auditLog` | `orgId`, `type`, `actorId`, `actorName` (snapshot at write time), `payload` (per-type object) | `by_org`, `by_org_type` |
| `suggestions` | `orgId`, `target` (kind + ids), `suggestedValue`, `motivation?`, `source` (`ai`), `status` (suggested/confirmed/rejected), `model?` (provenance), `confirmedBy?` | `by_org`, `by_org_status` |
| `emails` | outbox, see section 5 | `by_status` |

`suggestions` ships as schema only (AI-ready per ADR-0003; no AI calls in this slice). `anchorRoles` (calibration) is deliberately deferred to E7.

## 7. Function conventions, errors, audit

- Three builders replace raw `query`/`mutation` for all org-scoped work: `orgQuery`, `orgMutation` (membership), `adminMutation` (membership + admin role).
- Public functions always declare `args` and `returns` validators. Anything not client-facing is `internal*`. Every read path has an index; no `.filter` table scans; list endpoints `.take(n)` or paginate.
- Errors: `ConvexError({ code })` with stable machine keys (`errors.notAuthenticated`, `errors.notAMember`, `errors.adminRequired`, `errors.validation.*`). Codes are defined in one backend module the frontend imports for exhaustive mapping to i18n messages. No display text leaves Convex.
- Email failures degrade gracefully: invite row and outbox row persist, retries run in the background, failures are visible in `emails.status`.
- Audit: `logAudit(ctx, { type, payload })` inside the same mutation transaction as the change. V1-slice events: `workspace.created`, `member.added`, `member.roleChanged`, `member.removed`, `invitation.created`, `invitation.accepted`, `invitation.revoked`. Model/band events join in Fas 2/4.

## 8. Testing strategy

### Runner and config

- Vitest 4 everywhere, one runner for the repo. bun test is hard-blocked for the backend: convex-test requires `import.meta.glob`, which Bun's runtime does not implement (open issues oven-sh/bun#6060, get-convex/convex-test#9). Scripts say `vitest run`; invoked as `bun run test`, never `bun test`.
- Per-package `vitest.config.ts` extending a shared `@workspace/vitest-config` package. Per-package configs are what let Turborepo cache results per package. `vitest.workspace.ts` is removed in Vitest 4; do not create one.

| Package | Environment | Tested |
| --- | --- | --- |
| `packages/core` | `node` | engine invariants, importance scale, table-driven |
| `packages/backend` | `edge-runtime` + `server.deps.inline: ['convex-test']` | wrapper allow/deny matrix, triggers, outbox, audit |
| `packages/email` | `node` | per-template, per-locale snapshots |
| `packages/i18n` | `node` | message-file parity: every locale has exactly `en.json`'s key set |
| `apps/web`, `apps/dashboard` | `happy-dom` + RTL | client components, lib; next-intl first-party recipe |
| `packages/ui` | none | shadcn vendor code, untested by policy (matches Biome exclusion) |

### Backend test specifics (verified constraints)

- The Local Install component is registered manually in tests with our generated schema: `t.registerComponent('betterAuth', ourSchema, import.meta.glob('./betterAuth/**/*.ts'))`. The package's bundled `/test` helper registers the wrong (bundled) schema; do not use it.
- Identity via `t.withIdentity`; membership seeded directly into component tables via `t.run`.
- Full sign-up/sign-in/session round-trips do not work under convex-test (verified limitation); they belong to a deferred Playwright tier in CI. Async Server Components likewise: e2e, not unit.

### Coverage

`@vitest/coverage-v8`, thresholds per package (core/email 95 percent, backend 85, apps 80) via a separate `test:coverage` script. The plain `test` script skips coverage so the hook stays fast. Thresholds gate CI when CI lands. Coverage dirs are gitignored and listed as turbo `outputs`.

### turbo.json and pre-commit

- Add `"test": { "outputs": ["coverage/**"] }` (no `dependsOn`; nothing needs a build to test) and `"test:watch": { "cache": false, "persistent": true }`.
- Pre-commit becomes: Biome (staged), typecheck, `turbo run test`. Verified mechanics: Turborepo hashes the working tree (staged and unstaged content), so the hook tests what is being committed and unchanged packages replay from cache instantly. `--affected` was refuted for hooks: with a defined range end it diffs committed history only and misses staged changes, and it degrades to running everything on detached HEAD. Keep the single native `.githooks/pre-commit`; no husky/lint-staged layering.
- CI later: `turbo run test --affected` with full fetch depth, plus `convex codegen --typecheck enable` to catch generated-code drift, plus coverage thresholds and Playwright.

## 9. Build order (phases for the implementation plan)

1. Testing foundation: `@workspace/vitest-config`, turbo `test` task, pre-commit hook extension (so every later phase lands with tests from the first commit).
2. `packages/core` skeleton: constants, types, tests.
3. `packages/backend` scaffold + Convex provisioning. Manual steps documented: team default region EU West (Ireland) first, then project creation, then env vars.
4. Better Auth Local Install: org plugin, Admin/Editor access control, triggers + users mirror, membership query + index, auth tests.
5. Org-scoping wrappers + `workspaceProfiles` + audit log + tests.
6. `packages/email` + outbox + Scaleway TEM sender + invitation flow + tests.
7. Domain schema skeleton (evaluationModel, assessment, suggestions) pushed.
8. `apps/dashboard` minimal shell: provider, auth route, sign-in/up, accept-invitation, i18n keys in all five message files.

## 10. Out of scope (later slices)

Standard template seeding (standardmall), model CRUD, rating flow, results views, engine functions beyond the scale constant, AI calls, CSV import, Playwright e2e, company-setup form, calibration/anchor roles, CI pipeline.

## 11. Risks and compliance notes

- Version coupling: better-auth is peer-pinned to the 1.6.x line by the component. Renovate-style bumps must respect it.
- Open bugs designed around: get-convex/better-auth#157 (member index, restored manually), #222 (weak types on org custom fields; avoid custom fields on auth tables), #235 (getAuthUser under convex-test; wrappers avoid that path).
- Better Auth trigger semantics: no cross-operation atomicity within one endpoint call; all trigger logic idempotent.
- Convex compliance posture (verified): SOC 2 Type II, GDPR with published DPA, HIPAA via BAA. Convex does not self-certify ISO 27001 (only AWS-level certs underneath). Relevant to PLAN-V1 paragraph 7's ISO ambition and procurement conversations; Sysarb carries ISO 27001.
- Convex data-plane subprocessors (AWS, PlanetScale) follow the deployment region; several Convex operational subprocessors (Datadog, PostHog, Fullstory and similar) are US-based and may process operational metadata. Track in the subprocessor/DPA review; reconcile with the marketing claim wording for "all data in the EU".
- Resend explicitly rejected for EU residency (data stored in the US per their own GDPR page); revisit only if their residency posture changes.
- EU deployments billed on demand (no included quotas), about 30 percent higher resource pricing; the "as of now" qualifier means re-verify before launch.

## 12. References

- Better Auth + Convex component: labs.convex.dev/better-auth (installation, local install, triggers, supported plugins, authorization)
- Better Auth organization plugin: better-auth.com/docs/plugins/organization
- Convex regions and EU: docs.convex.dev/production/regions; news.convex.dev/we-finally-got-our-eu-visa/
- Convex authorization pattern: stack.convex.dev/authorization; convex-helpers custom functions
- Convex testing: docs.convex.dev/testing/convex-test; get-convex/convex-test#9
- Turborepo: turborepo.dev docs (configuring tasks, caching/file-inputs, reference/run for --affected semantics)
- Vitest 4: vitest.dev/guide/projects, vitest.dev/guide/migration
- Next.js testing: nextjs.org/docs/app/guides/testing (vitest, playwright); next-intl.dev/docs/environments/testing
- Scaleway TEM: scaleway.com/en/transactional-email-tem/
- Resend data residency (rejection basis): resend.com/security/gdpr; resend.com/docs/dashboard/domains/regions
- GitHub issues designed around: get-convex/better-auth#157, #222, #235, #350; oven-sh/bun#6060
