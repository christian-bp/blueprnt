# Security hardening batch (CRA gap analysis follow-up): design

Date: 2026-06-26
Status: approved for planning
Owner: Christian

## Background

A Cyber Resilience Act (Regulation (EU) 2024/2847) analysis concluded that blueprnt
is **out of CRA scope today**: it is a pure, hosted-only B2B web SaaS (Next.js
dashboard on Vercel + Convex backend in EU West/Ireland) with no installable or
downloadable component, so it is a service, not a "product with digital elements".
The CRA's Annex I requirements were used in that analysis as a control checklist
because they double as GDPR Article 32, NIS2, and procurement expectations.

This batch implements the low-cost, high-signal subset of that checklist. It does
not attempt CRA conformity (there is no obligation) and it does not touch the
deterministic score/band path, the AI boundary, or any domain logic. It is purely
security posture: disclosure, auth hardening, web hardening, and CI/supply-chain.

## Scope

### In scope (this batch)

1. **Vulnerability-disclosure files**: `SECURITY.md` and `/.well-known/security.txt`.
2. **Auth hardening**: sign-in rate limiting and explicit session/cookie hardening
   in `packages/backend/convex/auth.ts`.
3. **Web hardening**: security response headers and a Content-Security-Policy in
   `apps/dashboard/next.config.ts`, plus an EU region pin in
   `apps/dashboard/vercel.json`.
4. **CI and supply chain**: a GitHub Actions workflow that mirrors the pre-commit
   gates and adds dependency-audit (`bun audit`), CVE scanning (OSV-Scanner,
   which reads `bun.lock` natively against the OSV.dev corpus), secret-scan, and
   SBOM generation, plus a Renovate config for dependency updates. (Native GitHub
   Dependabot is not used: Bun is absent from GitHub's dependency graph as of
   mid-2026, so Dependabot security alerts do not fire from `bun.lock`.)

### Out of scope (separate efforts, by decision)

- **MFA/TOTP and enterprise SSO/OIDC**: a real feature with its own UX and Better
  Auth plugin design. Christian will brainstorm and spec it separately afterward.
  This is the single highest-impact security item and is deferred only to give it
  proper attention, not because it is low priority.
- **Governance docs that need real-world facts**: subprocessor list and DPA
  register, incident-response/breach-notification runbook, audit-log retention and
  access policy. Deferred because they need facts only the business can supply
  (signed DPAs, retention periods, IR owners, Mistral no-train confirmation).

### Dropped (with rationale)

- **"Add a DB-level unique composite index on `member(organizationId, userId)`"**:
  invalid as stated. `packages/backend/convex/betterAuth/schema.ts:11` already
  defines that composite index, and Convex has no unique indexes/constraints at all
  (uniqueness is only ever enforced application-side via read-before-write). Member
  rows are also inserted by the Better Auth organization component, not by our code,
  so there is no insert site of ours to guard. No action.
- **"Remove `seedProduction`"**: deferred, not done. `seed:seedProduction` is in
  active use as the pre-launch reset tool for the test deployment a teammate uses.
  Its removal is already tracked as a go-live task (the `TODO(go-live)` at
  `packages/backend/convex/seed.ts:139` and the "Before go-live" section of
  `packages/backend/README.md`). It stays until real customer data exists.

## Design

### 1. Vulnerability-disclosure files

**What**: a public way to report a security issue, the standard procurement/NIS2
supplier ask.

**Files**:
- `SECURITY.md` (repo root): how to report, the disclosure contact
  (`hej@blueprnt.se`), expected response handling, and a short scope note. English
  (code/docs are English per CLAUDE.md).
- `apps/dashboard/public/.well-known/security.txt`: RFC 9116 format. Fields:
  `Contact: mailto:hej@blueprnt.se`, `Expires:` (a date roughly one year out),
  `Preferred-Languages: en, sv`. Served as a static file from the dashboard's
  `public/` directory, so it is reachable at `/.well-known/security.txt`.

**Risk**: none (static content, no runtime path).

**Verification**: file exists and parses; `security.txt` served at the well-known
path in a local run.

**Open item to confirm during implementation**: that the dashboard's `proxy.ts`
matcher does not intercept `/.well-known/...`. The current matcher excludes
`api`, `_next`, `_vercel`, and any path containing a dot, so `security.txt`
(contains a dot) is already excluded. Confirm, do not assume.

### 2. Auth hardening (`packages/backend/convex/auth.ts`)

**What**: close two gaps in the existing Better Auth setup. Today only the
password-reset endpoints are rate-limited, and session/cookie attributes rely on
Better Auth defaults rather than being explicit.

**Changes** (inside `createAuthOptions`):
- **Sign-in rate limit**: add a rule for the sign-in endpoint to the existing
  `rateLimit.customRules` map (which already throttles `/request-password-reset`
  and `/forget-password` with `storage: "database"`). Target the credential
  sign-in path with a tight window (proposed: `window: 60, max: 5`). The exact
  endpoint path string and option shape must be verified against the installed
  `better-auth@1.6.17` and `@convex-dev/better-auth@0.12.3` (the codebase has an
  established habit of version-checking auth options; the existing comment block
  documents this).
- **Session lifetime**: set explicit `session.expiresIn` and `session.updateAge`
  rather than relying on defaults.
- **Cookie/transport hardening**: set explicit `advanced.defaultCookieAttributes`
  (`sameSite`, `secure`, `httpOnly`), an `advanced.cookiePrefix`, and
  `trustedOrigins`. Better Auth's defaults are already mostly secure; this makes
  the posture explicit and reviewable and pins it against future default changes.

**Data flow / behavior**: no change to who can authenticate or to the data model.
Rate limiting reuses the existing component `rateLimit` table (survives across
Convex isolates, as documented in the current comment). Tighter session lifetime
may sign idle users out sooner; chosen values must balance security and the UX of
an internal HR tool.

**Risk**: medium. Wrong endpoint path means the rate limit silently does nothing;
too-tight values could lock out legitimate users or shorten sessions
disruptively. Mitigated by version-verifying the option names and choosing
conservative values.

**Verification**: backend tests stay green; a local run confirms sign-in still
works and that repeated bad sign-ins are throttled. Full sign-in round-trips are
e2e scope (Playwright, later) per CLAUDE.md, so unit coverage here is limited to
what convex-test can assert about configuration.

### 3. Web hardening (`apps/dashboard/next.config.ts`, `apps/dashboard/vercel.json`)

**What**: add security response headers, a CSP, and pin the web tier to an EU
region so SSR/route handlers that hold the auth token do not execute outside the
EU.

**Headers** (via `next.config.ts` `async headers()` returning a rule for all
routes):
- `Strict-Transport-Security` (HSTS, long max-age + `includeSubDomains`)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (deny camera/microphone/geolocation and other unused
  features)

**CSP**: ship as **`Content-Security-Policy-Report-Only` first** (decision).
Rationale: a strict CSP can silently break the app. The Convex client opens a
WebSocket and HTTPS connection to the deployment URL, so `connect-src` must
include the Convex URL (derived from `NEXT_PUBLIC_CONVEX_URL` at build time), and
Next.js hydration uses inline scripts, which a strict policy blocks without a
per-request nonce. Report-Only lets us observe violations with zero breakage. A
strict, enforcing, nonce-based CSP (which requires generating a nonce in
`proxy.ts` and threading it through) is a **flagged follow-up**, not part of this
batch.

**EU region pin** (`vercel.json`): set `regions` to **`["dub1"]`** (Dublin),
co-located with the Convex EU West/Ireland deployment to minimize SSR-to-Convex
latency while keeping the web tier in the EU. The exact `vercel.json` field and
its interaction with the existing `buildCommand` (the Convex deploy chain) must be
verified against current Vercel config docs during implementation, since the file
currently contains only `buildCommand`.

**Risk**: medium-high, the highest-breakage item, which is why it ships last and
is verified against a running app. Report-Only CSP de-risks the CSP specifically.
Region pin is low-risk but must not disturb the build command.

**Verification**: run the dashboard locally (and/or a Vercel preview); confirm the
app loads, the Convex realtime connection establishes, navigation works, and the
browser console shows only expected CSP Report-Only violations (which inform the
future enforcing policy). Confirm headers are present via response inspection.

### 4. CI and supply chain (`.github/workflows/`, `renovate.json`)

**What**: move the secure-build gate off the bypassable local pre-commit hook and
add supply-chain checks. Origin is already on GitHub (`christian-bp/blueprnt`).

**CI workflow** (`.github/workflows/ci.yml`, on pull_request and push to main):
- Set up Bun (matching `packageManager: bun@1.3.14`) and install with
  `--frozen-lockfile`.
- Mirror the pre-commit gates: `biome ci` (the CI-appropriate Biome command, since
  CI is not staged-aware), `turbo run typecheck`, `turbo run test`.
- Add `bun audit` (already available in the pinned toolchain) to surface known CVEs
  in dependencies.
- Add a secret scan (gitleaks) over the repo/diff.
- Generate a CycloneDX SBOM (via `cdxgen`, which supports Bun lockfiles) and upload
  it as a workflow artifact per run.

**Renovate** (`renovate.json`, decision: Renovate over Dependabot for better Bun
and monorepo support; run as a scheduled GitHub Action so there is no GitHub App to
install): grouped, scheduled dependency-update PRs. Security-sensitive deps (auth,
convex, next) get their own attention; broad caret-range updates are batched.

**Risk**: low. Additive and cannot break the running app. Worst case is a red CI
check, which is the point. Note: turbo's remote cache is not assumed; CI relies on
local task caching only unless a cache is configured later.

**Verification**: the workflow runs green on a test PR; the SBOM artifact is
produced; gitleaks and `bun audit` execute. Renovate config validates (Renovate
has a config validator).

## Cross-cutting concerns

**Testing**: most of this batch is configuration that is not meaningfully
unit-testable (headers, region, CI YAML, Renovate config). Per CLAUDE.md "new code
ships with tests", any actual logic added (for example, if the sign-in rate-limit
work introduces a testable helper) ships with a test. Config changes are verified
by running the app and by CI going green, documented per item above. We will not
claim a config item works without having observed it working.

**i18n**: `SECURITY.md` and `security.txt` are operational/security files, not
product UI, so they are not subject to the i18n message-file rules. No user-facing
in-app strings are added by this batch.

**Style**: no em dashes in any added text (CLAUDE.md). Code and comments in English.

**Commit strategy**: themed, single-concern, independently-shippable commits,
ordered safest-first, left uncommitted for review per CLAUDE.md (no branches, no
worktrees):
1. Disclosure files
2. CI + supply chain
3. Auth hardening
4. Web headers + CSP + region pin

(seedProduction removal is intentionally absent; it is a go-live task, not part of
this batch.)

## Flagged follow-ups (not this batch)

- Strict, enforcing, nonce-based CSP via `proxy.ts`, informed by the Report-Only
  violation reports collected after this batch ships.
- MFA/TOTP + SSO/OIDC (separate spec).
- Governance docs: subprocessor/DPA register, IR/breach runbook, audit-log
  retention and access policy.
- Supply-chain/malware detection: add Socket.dev's free tier (it understands
  `bun.lock`, is free for the monorepo, and catches malicious or typosquatted
  packages that known-CVE scanners do not).
- Go-live: remove `seedProduction` and reassess the remaining wipe-capable
  surfaces (already tracked in `packages/backend/README.md`).
