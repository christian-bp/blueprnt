# Security Hardening Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the low-cost, high-signal security-posture items from the CRA gap analysis (disclosure files, auth hardening, web hardening, CI and supply chain), without touching domain logic, the deterministic score/band path, or the AI boundary.

**Architecture:** Each item is an isolated config/file change committed as a focused single-concern commit, ordered safest-first. No new runtime logic is introduced, so verification is by typecheck, the existing test suite, running the app, and running the CI commands locally. The GitHub-side CI run is verified after the user pushes (no push happens without explicit approval).

**Tech Stack:** Bun 1.3.14 + Turborepo, Next.js 16.2.9 (apps/dashboard) on Vercel, Convex (packages/backend) in EU West/Ireland, better-auth 1.6.17 + @convex-dev/better-auth 0.12.3, Biome 2.4.16, GitHub Actions (origin christian-bp/blueprnt).

## Global Constraints

- Code, comments, docs, commit messages in **English**. No AI/Claude attribution anywhere.
- **Never use em dashes** in any added text. Use periods, commas, colons, or parentheses.
- Commit messages use **Conventional Commits** (`feat:`, `fix:`, `chore:`, `ci:`, `docs:`).
- **Leave work uncommitted for review**; commit only on explicit approval; work on `main` (no branches, no worktrees); **never push** without explicit OK.
- The pre-commit hook runs Biome (staged) + `bun run typecheck` + `bun run test` and must pass; never `--no-verify`.
- shadcn vendor code (`packages/ui/src/*`) and Convex `_generated` are out of bounds for edits.
- This batch adds **no user-facing UI strings**, so the i18n message-file rules do not apply. `SECURITY.md` and `security.txt` are operational files, not product copy.

---

## File Structure

**Create:**
- `SECURITY.md` (repo root) — vulnerability-disclosure policy.
- `apps/dashboard/public/.well-known/security.txt` — RFC 9116 machine-readable disclosure pointer.
- `.github/workflows/ci.yml` — lint/typecheck/test/audit gates mirroring the pre-commit hook.
- `.github/workflows/sbom.yml` — CycloneDX SBOM generation + artifact upload.
- `.github/workflows/osv-scanner-pr.yml` + `.github/workflows/osv-scanner-scheduled.yml` — OSV-Scanner CVE scanning (reads `bun.lock` natively, OSV.dev corpus).
- `.github/workflows/secret-scan.yml` — gitleaks CLI secret scan (license-free).
- `.github/workflows/renovate.yml` — self-hosted Renovate runner.
- `renovate.json` (repo root) — Renovate config.

**Modify:**
- `packages/backend/convex/auth.ts` — add sign-in rate limit, `session`, `advanced` cookie hardening, `trustedOrigins`.
- `apps/dashboard/next.config.ts` — add `headers()` with security headers + Report-Only CSP.
- `apps/dashboard/vercel.json` — add `"regions": ["dub1"]`.
- `.gitignore` (repo root) — ignore the generated `sbom.json`.

**Commit order (safest-first):** Task 1 (disclosure) -> Task 2 (CI gates) -> Task 3 (SBOM) -> Task 4 (OSV-Scanner) -> Task 5 (secret scan) -> Task 6 (Renovate) -> Task 7 (auth) -> Task 8 (headers/CSP) -> Task 9 (region).

---

## Task 1: Vulnerability-disclosure files

**Files:**
- Create: `SECURITY.md`
- Create: `apps/dashboard/public/.well-known/security.txt`

**Context:** No `SECURITY.md` or `security.txt` exists today. The dashboard `proxy.ts` matcher `"/((?!api|_next|_vercel|.*\\..*).*)"` already excludes any path containing a dot, so `/.well-known/security.txt` is served as a static file and is not intercepted. No runtime risk.

- [ ] **Step 1: Create `SECURITY.md`**

```markdown
# Security Policy

blueprnt is a hosted service (a web application on Vercel with a Convex backend
in the EU). There is no installable or downloadable product. The latest deployed
version is always the supported version.

## Reporting a vulnerability

Please email **hej@blueprnt.se** with:

- a description of the issue and its impact,
- the steps to reproduce it,
- any affected URLs, accounts, or requests (do not include other people's
  personal data),
- your name or handle if you would like to be credited.

We aim to acknowledge a report within 5 working days and to keep you informed as
we investigate and remediate. Please give us a reasonable period to fix an issue
before any public disclosure, and we will coordinate timing with you.

## Scope

In scope: the blueprnt web application and its backend API.

Please test only against accounts and data you own. Out of scope, and not
permitted: accessing or modifying other customers' data, denial-of-service or
load testing, social engineering, and physical attacks. Good-faith research that
respects these limits is welcome and we will not pursue action against it.
```

- [ ] **Step 2: Create `apps/dashboard/public/.well-known/security.txt`**

```text
# blueprnt security contact (RFC 9116)
Contact: mailto:hej@blueprnt.se
Expires: 2027-06-26T00:00:00.000Z
Preferred-Languages: en, sv
# Canonical: https://<production-domain>/.well-known/security.txt
# Set the Canonical line once the production domain is fixed.
```

- [ ] **Step 3: Verify the files exist and the path is correct**

Run:
```bash
test -f SECURITY.md && test -f apps/dashboard/public/.well-known/security.txt && echo OK
```
Expected: `OK`

- [ ] **Step 4: Verify the file is served (optional local check)**

Run the dashboard (`bun run --cwd apps/dashboard dev`), then:
```bash
curl -s http://localhost:3000/.well-known/security.txt | head -3
```
Expected: the first three lines of `security.txt` (the comment + `Contact:` + `Expires:`).

- [ ] **Step 5: Commit**

```bash
git add SECURITY.md apps/dashboard/public/.well-known/security.txt
git commit -m "docs: add security disclosure policy and security.txt"
```

---

## Task 2: CI workflow (lint, typecheck, test, audit)

**Files:**
- Create: `.github/workflows/ci.yml`

**Context:** There is no `.github/` yet; the secure-build gate is a local, bypassable pre-commit hook. This adds a server-side gate mirroring it (`biome ci .`, `turbo run typecheck`, `turbo run test`) plus `bun audit`. Verified facts: `biome ci .` is the non-writing CI command for Biome 2.4.16 and exits non-zero on any diagnostic; `bun audit --audit-level=high` fails only on high/critical; CI installs with `bun install --frozen-lockfile`; pin Bun to 1.3.14 via `oven-sh/setup-bun@v2`.

**Interfaces:**
- Produces: the `ci.yml` workflow other tasks' workflows sit beside. No code interface.

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Biome (lint + format check)
        run: bun x biome ci .

      - name: Typecheck
        run: bun run turbo run typecheck

      - name: Tests
        run: bun run turbo run test

      - name: Audit dependencies
        run: bun audit --audit-level=high
```

- [ ] **Step 2: Verify each gate passes locally (this is the real verification; the GitHub run is confirmed after push)**

Run each, from the repo root:
```bash
bun x biome ci .
bun run turbo run typecheck
bun run turbo run test
bun audit --audit-level=high
```
Expected: all four exit 0. `biome ci .` prints "Checked N files" with no errors; typecheck and test pass; `bun audit` prints no high/critical advisories. If `bun audit` reports a high/critical advisory, stop and triage it (this is the gate working, not a plan failure); decide between upgrading the dependency or adding `--ignore=<CVE>` with a documented reason.

- [ ] **Step 3: Validate the workflow YAML**

Run:
```bash
bun x --bun yaml-lint .github/workflows/ci.yml 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"
```
Expected: `yaml ok` (or yaml-lint success). This catches syntax errors before pushing.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow mirroring pre-commit gates plus bun audit"
```

---

## Task 3: SBOM workflow

**Files:**
- Create: `.github/workflows/sbom.yml`
- Modify: `.gitignore`

**Context:** Generate a CycloneDX SBOM as a build artifact. Verified fact: `@cyclonedx/cdxgen` has NO bun.lock parser, so `bun install` must run first to populate `node_modules`; then `cdxgen -t js -r` reads the resolved tree. Pin `@cyclonedx/cdxgen@12`. Use `actions/upload-artifact@v7`. Do not commit the generated `sbom.json`.

- [ ] **Step 1: Create `.github/workflows/sbom.yml`**

```yaml
name: SBOM

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.14

      # Populate node_modules so cdxgen reads the resolved tree instead of
      # trying (and failing) to parse bun.lock or falling back to npm/yarn.
      - name: Install dependencies
        run: bun install --frozen-lockfile

      # cdxgen runs on the runner's Node (ubuntu-latest ships Node >= 20).
      # -t js = JavaScript/Node project, -r = recurse the workspace,
      # --spec-version 1.6 = CycloneDX 1.6, -o = output file.
      - name: Generate CycloneDX SBOM
        run: npx -y @cyclonedx/cdxgen@12 -t js -r --spec-version 1.6 -o sbom.json .
        env:
          FETCH_LICENSE: "true"

      - name: Upload SBOM
        uses: actions/upload-artifact@v7
        with:
          name: sbom
          path: sbom.json
          if-no-files-found: error
```

- [ ] **Step 2: Ignore the generated SBOM**

Add this line to `.gitignore` (repo root):
```text
sbom.json
```

- [ ] **Step 3: Verify SBOM generation locally**

Run from the repo root:
```bash
bun install --frozen-lockfile
npx -y @cyclonedx/cdxgen@12 -t js -r --spec-version 1.6 -o sbom.json .
python3 -c "import json; d=json.load(open('sbom.json')); print(d['bomFormat'], d['specVersion'], 'components:', len(d.get('components', [])))"
```
Expected: `CycloneDX 1.6 components: <a number well over 100>`. (The repo resolves ~1,128 packages, so the component count should be large, confirming cdxgen read the tree rather than producing an empty SBOM.)

- [ ] **Step 4: Confirm the SBOM is not staged**

Run:
```bash
git status --porcelain sbom.json
```
Expected: no output (ignored by `.gitignore`).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/sbom.yml .gitignore
git commit -m "ci: generate CycloneDX SBOM artifact on main"
```

---

## Task 4: CVE scanning with OSV-Scanner

**Files:**
- Create: `.github/workflows/osv-scanner-pr.yml`
- Create: `.github/workflows/osv-scanner-scheduled.yml`

**Context:** OSV-Scanner is the CVE *scanner* layer, distinct from `bun audit` (Task 2) and Renovate (Task 6). Verified facts: it reads the text `bun.lock` natively and statically (no `bun install`), backed by the OSV.dev database, a broader corpus than the GitHub Advisory DB that `bun audit` uses, so it adds signal rather than duplicating. Use the official reusable workflows pinned to the action tag `@v2.3.8` (the action is versioned separately from the CLI, currently v2.4.0; `v2.3.8` is the current action tag). The reusable workflows default `scan-args` to `-r ./`, which recursively discovers the root `bun.lock` and any package lockfiles, so no path input is needed. The PR variant annotates and fails only on NEWLY introduced vulnerabilities (low noise on an existing repo); the scheduled variant runs a full scan and uploads SARIF.

**IMPORTANT caveat (private-repo SARIF):** uploading SARIF to the Security tab needs GitHub code scanning, which on a PRIVATE repo requires GitHub Advanced Security (a paid add-on). blueprnt's repo is private and org-owned, so if code scanning is not enabled, the scheduled job's SARIF upload step fails. Either (a) enable code scanning for the repo, or (b) add `with: { upload-sarif: false }` to the scheduled job and rely on the PR job plus the run logs. The PR-diff job and its pass/fail check work regardless of GHAS.

- [ ] **Step 1: Create `.github/workflows/osv-scanner-pr.yml`**

```yaml
# Scans each PR and annotates ONLY vulnerabilities the PR newly introduces
# (diffs the base branch against the PR branch). Reads the root bun.lock
# statically via the default scan-args "-r ./". Pinned to the current action
# tag v2.3.8 (the osv-scanner-action repo is versioned separately from the CLI).
name: OSV-Scanner PR Scan

on:
  pull_request:
    branches: [main]

permissions:
  actions: read
  contents: read
  security-events: write

jobs:
  scan-pr:
    uses: "google/osv-scanner-action/.github/workflows/osv-scanner-reusable-pr.yml@v2.3.8"
```

- [ ] **Step 2: Create `.github/workflows/osv-scanner-scheduled.yml`**

```yaml
# Full repository vulnerability scan weekly and on pushes to main. Uploads SARIF
# to GitHub Security > Code Scanning. NOTE: on a private repo, SARIF upload needs
# GitHub Advanced Security; if not enabled, add `with: { upload-sarif: false }`.
name: OSV-Scanner Scheduled Scan

on:
  schedule:
    - cron: "30 12 * * 1" # Mondays 12:30 UTC
  push:
    branches: [main]

permissions:
  actions: read
  contents: read
  security-events: write

jobs:
  scan-scheduled:
    uses: "google/osv-scanner-action/.github/workflows/osv-scanner-reusable.yml@v2.3.8"
```

- [ ] **Step 3: Validate the workflow YAML**

Run:
```bash
python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/osv-scanner-pr.yml','.github/workflows/osv-scanner-scheduled.yml']]; print('yaml ok')"
```
Expected: `yaml ok`

- [ ] **Step 4: (Optional) confirm OSV-Scanner reads the lockfile locally**

If the `osv-scanner` binary is installed locally (`brew install osv-scanner`), run a recursive scan of the repo root per its `--help` (v2 exposes a `scan source` subcommand); it auto-discovers the root `bun.lock`. This is optional: the reusable workflows are the real verification and run in CI after push. Any reported vulnerability is a real finding to triage, not a plan failure.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/osv-scanner-pr.yml .github/workflows/osv-scanner-scheduled.yml
git commit -m "ci: add OSV-Scanner CVE scanning (PR diff plus scheduled full scan)"
```

Deferred follow-up (not this batch): add Socket.dev's free tier for supply-chain/malware/typosquatting detection. It understands `bun.lock`, is free for the monorepo, and catches malicious or typosquatted packages that known-CVE scanners do not.

---

## Task 5: Secret scanning (gitleaks CLI, license-free)

**Files:**
- Create: `.github/workflows/secret-scan.yml`

**Context:** The `gitleaks/gitleaks-action` requires a paid `GITLEAKS_LICENSE` for org-owned repos (blueprnt is under the `christian-bp` org). To avoid that dependency, run the gitleaks CLI directly: the scanner itself is open-source and free; only the Action wrapper is licensed for orgs. `fetch-depth: 0` is required so the full history is available for a scheduled full scan.

- [ ] **Step 1: Create `.github/workflows/secret-scan.yml`**

```yaml
name: secret-scan

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
  schedule:
    - cron: "0 4 * * 1" # weekly full-history sweep, Mondays 04:00 UTC

jobs:
  gitleaks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install gitleaks
        run: |
          VERSION=8.30.0
          curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz" \
            | tar -xz -C /usr/local/bin gitleaks
          gitleaks version

      - name: Scan repository
        run: gitleaks dir . --redact --verbose
```

- [ ] **Step 2: Verify the scan runs clean locally**

If gitleaks is installed locally (`brew install gitleaks`), run:
```bash
gitleaks dir . --redact --verbose
```
Expected: `no leaks found` (exit 0). If gitleaks is not installed locally, this is acceptable to defer to the CI run; note that in the task. If a leak is reported, stop: rotate the exposed secret and remove it from the working tree before continuing.

- [ ] **Step 3: Validate the workflow YAML**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/secret-scan.yml')); print('yaml ok')"
```
Expected: `yaml ok`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/secret-scan.yml
git commit -m "ci: add gitleaks secret scanning"
```

---

## Task 6: Renovate (dependency updates)

**Files:**
- Create: `renovate.json`
- Create: `.github/workflows/renovate.yml`

**Context:** Self-hosted Renovate via the official action (no Mend GitHub App). Verified facts: Renovate supports the text `bun.lock`; `config:recommended` already provides the Dependency Dashboard and external-monorepo grouping; the security-sensitive deps to isolate are `better-auth` 1.6.17, `@convex-dev/better-auth` 0.12.3, `convex` ^1.41.0, `next` 16.2.9.

**PREREQUISITE (manual, user action, blocks the CI run but not the commit):** The built-in `GITHUB_TOKEN` cannot drive Renovate (too restrictive; its PRs would not trigger CI). A `RENOVATE_TOKEN` secret is required: either a classic PAT with `repo` + `workflow` scopes, or a GitHub App token (preferred, not tied to a person, and its PRs trigger CI). Create it and add it as a repo secret:
```bash
gh secret set RENOVATE_TOKEN --repo christian-bp/blueprnt
```
The workflow files can be committed before this exists; Renovate simply will not run successfully until the secret is present.

- [ ] **Step 1: Create `renovate.json` (repo root)**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":dependencyDashboard",
    "schedule:weekly"
  ],
  "timezone": "Europe/Stockholm",
  "labels": ["dependencies"],
  "rangeStrategy": "bump",
  "lockFileMaintenance": {
    "enabled": true,
    "schedule": ["before 6am on monday"]
  },
  "packageRules": [
    {
      "description": "Group all non-major devDependency updates into one PR",
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["minor", "patch"],
      "groupName": "devDependencies (non-major)"
    },
    {
      "description": "Keep security-sensitive packages on their own, never grouped",
      "matchPackageNames": [
        "better-auth",
        "@convex-dev/better-auth",
        "convex",
        "next"
      ],
      "groupName": null,
      "separateMinorPatch": true,
      "labels": ["dependencies", "security-sensitive"]
    }
  ],
  "vulnerabilityAlerts": {
    "labels": ["security"]
  }
}
```

- [ ] **Step 2: Create `.github/workflows/renovate.yml`**

```yaml
name: Renovate

on:
  schedule:
    - cron: "0 6 * * 1" # Mondays 06:00 UTC; renovate.json schedule gates what opens
  workflow_dispatch:

concurrency:
  group: renovate
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  renovate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Self-hosted Renovate
        uses: renovatebot/github-action@v46.1.16
        with:
          token: ${{ secrets.RENOVATE_TOKEN }}
        env:
          RENOVATE_REPOSITORIES: ${{ github.repository }}
          RENOVATE_PLATFORM: github
```

- [ ] **Step 3: Validate the Renovate config**

Run:
```bash
npx -y --package renovate -- renovate-config-validator renovate.json
```
Expected: `Config validated successfully` (a warning about the deprecated/abbreviated preset name is acceptable; an error is not).

- [ ] **Step 4: Validate the workflow YAML**

Run:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/renovate.yml')); print('yaml ok')"
```
Expected: `yaml ok`

- [ ] **Step 5: Commit**

```bash
git add renovate.json .github/workflows/renovate.yml
git commit -m "ci: add self-hosted Renovate for dependency updates"
```

---

## Task 7: Auth hardening (`packages/backend/convex/auth.ts`)

**Files:**
- Modify: `packages/backend/convex/auth.ts` (inside the object returned by `createAuthOptions`)
- Test: `packages/backend` existing suite (`bun run --cwd packages/backend test`)

**Context:** Add four hardening options to the existing `createAuthOptions` return object (peers of `baseURL`, `database`, `rateLimit`, `emailAndPassword`, `plugins`). Verified facts: the credential sign-in rate-limit key is `"/sign-in/email"` (base-path-stripped); `session.expiresIn`/`updateAge`/`freshAge` are in seconds; `advanced.defaultCookieAttributes`, `advanced.useSecureCookies`, `advanced.cookiePrefix`, and top-level `trustedOrigins` exist and DO take effect (the @convex-dev/better-auth Next handler is a transparent reverse proxy that does not rewrite cookies). The object closes with `satisfies BetterAuthOptions`, so wrong shapes are a typecheck error.

**Caveats baked into the code below:**
- `useSecureCookies` is gated so it is forced in production but not on `http://localhost` (browsers drop Secure cookies on http, which would break local sign-in).
- `cookiePrefix` is intentionally NOT changed (changing it renames cookies and invalidates all sessions). Left out, not commented-as-active.
- `trustedOrigins` is set to the dashboard public origin (`resolvedBaseUrl`), not the `.convex.site` URL.
- Auth options are evaluated where `betterAuth()` runs (inside Convex), so the **Convex backend must be redeployed** for these to take effect, not just the Next app.

- [ ] **Step 1: Add the sign-in rate-limit rule**

In `packages/backend/convex/auth.ts`, extend the existing `rateLimit.customRules` object (currently has `/request-password-reset` and `/forget-password`) to add the sign-in rule:

```ts
    rateLimit: {
      storage: "database",
      customRules: {
        "/request-password-reset": { window: 60, max: 3 },
        "/forget-password": { window: 60, max: 3 },
        // Credential email sign-in: throttle brute-force / credential stuffing.
        // Key is the base-path-stripped route ("/api/auth" prefix is removed
        // before matching). Verified against better-auth 1.6.17:
        // createAuthEndpoint("/sign-in/email", ...).
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
```

- [ ] **Step 2: Add session lifetime, cookie hardening, and trusted origins**

In the same returned object, add these three peers (place them after `emailAndPassword` and before `plugins`). `resolvedBaseUrl` is already in scope in `createAuthOptions`:

```ts
    // Session lifetime hardening. All values in SECONDS (verified against
    // @better-auth/core 1.6.17 types). Defaults are 7d / 1d / 1d; kept explicit
    // so the posture is reviewable and pinned against future default changes.
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 60 * 24,
    },
    advanced: {
      // Force the Secure attribute (and __Secure- prefix) in production. Gated
      // so local http://localhost sign-in is not broken (browsers drop Secure
      // cookies on http). The Convex Next proxy forwards x-forwarded-proto, so
      // this makes the secure posture deterministic behind Vercel.
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
    // Origins better-auth trusts for CSRF / redirect validation (checked
    // server-side in Convex against the forwarded host/origin). Use the
    // dashboard's public origin, NOT the .convex.site backend URL.
    trustedOrigins: [resolvedBaseUrl],
```

- [ ] **Step 3: Typecheck (this is the shape verification, via `satisfies BetterAuthOptions`)**

Run:
```bash
bun run --cwd packages/backend typecheck
```
Expected: PASS with no errors. A wrong option name or shape fails here.

- [ ] **Step 4: Run the backend test suite**

Run:
```bash
bun run --cwd packages/backend test
```
Expected: PASS (no regressions). Full sign-in round-trips are e2e scope and not covered here; this confirms nothing else broke.

- [ ] **Step 5: Runtime smoke test (redeploy Convex dev, then exercise auth)**

With `bun run --cwd packages/backend dev` running (deploys the changed auth options to the dev Convex deployment) and the dashboard running:
- Sign in with the seeded dev user (`hej@blueprnt.se` / `abc123`) and confirm it succeeds.
- Submit wrong credentials to `/sign-in/email` more than 5 times within 60 seconds and confirm later attempts are rate-limited (HTTP 429 / a too-many-requests error).

Expected: normal sign-in works; the 6th rapid bad attempt is throttled. If sign-in fails entirely on localhost, confirm `useSecureCookies` resolved to `false` in dev (it is gated on `NODE_ENV === "production"`).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/auth.ts
git commit -m "feat(auth): rate-limit sign-in and harden session and cookie settings"
```

---

## Task 8: Web security headers and Report-Only CSP (`apps/dashboard/next.config.ts`)

**Files:**
- Modify: `apps/dashboard/next.config.ts`

**Context:** Add an `async headers()` to the existing `nextConfig` object (the one passed into `withNextIntl`, so the wrapper and `transpilePackages` are preserved). Verified facts: `headers()` returns `[{ source, headers: [{ key, value }] }]` and is NOT awaited; CSP ships **Report-Only** first; `connect-src` needs only the `.convex.cloud` origin in both `https:` and `wss:` (the browser never calls `.convex.site` directly; it goes through the same-origin `/api/auth` proxy); derive the Convex origin from `NEXT_PUBLIC_CONVEX_URL` at build time. The candidate file was confirmed to typecheck against next 16.2.9.

- [ ] **Step 1: Replace `apps/dashboard/next.config.ts` with the hardened version**

```ts
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const isDev = process.env.NODE_ENV === "development"

// Convex serves the HTTP API over https and the reactive sync over wss on the
// same origin. Derive both from NEXT_PUBLIC_CONVEX_URL so connect-src stays
// correct across dev, preview, and prod Convex deployments. The browser reaches
// the auth backend only via the same-origin /api/auth proxy, so .convex.site is
// intentionally NOT listed here.
const convexHttpUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? ""
const convexWsUrl = convexHttpUrl
  .replace(/^https:/, "wss:")
  .replace(/^http:/, "ws:")

const cspReportOnly = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline' for its bootstrap unless we move to a
  // nonce-based CSP in proxy.ts (a flagged follow-up). 'unsafe-eval' is only
  // needed by React in development.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${convexHttpUrl} ${convexWsUrl}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ")

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: cspReportOnly },
]

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/backend", "@workspace/i18n", "@workspace/ui"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
```

- [ ] **Step 2: Typecheck and Biome**

Run:
```bash
bun run --cwd apps/dashboard typecheck
bun x biome check apps/dashboard/next.config.ts
```
Expected: both PASS.

- [ ] **Step 3: Runtime verification (headers present, app not broken, CSP clean)**

With the dashboard running (`bun run --cwd apps/dashboard dev`):
```bash
curl -sI http://localhost:3000/ | grep -iE "strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy|content-security-policy-report-only"
```
Expected: all six headers present, including `Content-Security-Policy-Report-Only` with a `connect-src` listing the `https://` and `wss://` Convex origins.

Then in a browser: load the dashboard, sign in, navigate, and confirm in DevTools that (a) live data loads (the Convex WebSocket connects) and (b) the console shows no CSP violations that would block the app once enforced. Report-Only means nothing is blocked; you are collecting violations. Note any legitimate violation for the future enforcing-CSP follow-up.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/next.config.ts
git commit -m "feat(dashboard): add security headers and a report-only CSP"
```

---

## Task 9: Pin the web tier to an EU region (`apps/dashboard/vercel.json`)

**Files:**
- Modify: `apps/dashboard/vercel.json`

**Context:** Add `"regions": ["dub1"]` (Dublin, eu-west-1) so SSR/route handlers that hold the auth token execute in the EU, co-located with the Convex EU West/Ireland deployment. Verified facts: `regions` is a top-level key that coexists with `buildCommand`, App Router functions honor it, and a single region is allowed on every Vercel plan. Confirm the Vercel project Root Directory is `apps/dashboard` (the `buildCommand`'s relative `cd` paths already assume this).

- [ ] **Step 1: Edit `apps/dashboard/vercel.json`**

Final content (keeps `buildCommand`, adds `regions`):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../../packages/backend && bunx convex deploy --cmd 'cd ../../apps/dashboard && bun run build'",
  "regions": ["dub1"]
}
```

- [ ] **Step 2: Verify it is valid JSON**

Run:
```bash
python3 -c "import json; d=json.load(open('apps/dashboard/vercel.json')); print('regions:', d['regions']); print('buildCommand kept:', 'buildCommand' in d)"
```
Expected: `regions: ['dub1']` and `buildCommand kept: True`.

- [ ] **Step 3: Post-deploy verification (after the user deploys)**

This cannot be verified locally. After the next Vercel deploy, open the deployment's Resources/Functions view and confirm the region shows `dub1`. Note this as a deferred check in the task close-out.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/vercel.json
git commit -m "chore(dashboard): pin Vercel functions to the Dublin EU region"
```

---

## Self-Review

**Spec coverage:**
- Disclosure files (SECURITY.md + security.txt) -> Task 1. Covered.
- Auth hardening (sign-in rate limit + session/cookie) -> Task 7. Covered.
- Web headers + CSP + EU region pin -> Tasks 8 and 9. Covered.
- CI + supply chain (gates + audit + SBOM + CVE scan + secret scan + Renovate) -> Tasks 2, 3, 4, 5, 6. Covered. (The spec's single "CI + supply chain" commit is refined into single-concern commits per the project's commit rules; a reviewer can accept CI gates while rejecting the Renovate token setup, which justifies the split.) Task 4 (OSV-Scanner) was added per the CVE-tooling research as the Bun-aware CVE *scanner* the other layers did not provide: `bun audit` uses the GHSA corpus, OSV-Scanner adds the broader OSV.dev corpus, and Renovate only remediates.
- Out of scope (MFA/SSO, governance docs) -> not present. Correct.
- Dropped (member index, seedProduction removal) -> not present. Correct.

**Placeholder scan:** No "TBD"/"add error handling"/"similar to Task N". Every step has exact content. The one intentional placeholder is the commented `# Canonical:` line in `security.txt`, which is a genuine deferred input (production domain) and is marked as such, not a plan gap.

**Type/identifier consistency:** `resolvedBaseUrl` (Task 7) matches the existing variable in `auth.ts`. `NEXT_PUBLIC_CONVEX_URL` (Task 8) matches the env var read in `components/providers.tsx`. Region code `dub1` consistent across spec and plan. Bun version `1.3.14` consistent across Tasks 2, 3. Action pins (`@cyclonedx/cdxgen@12`, `renovatebot/github-action@v46.1.16`, `oven-sh/setup-bun@v2`, `actions/upload-artifact@v7`, `actions/checkout@v4`, `google/osv-scanner-action/...@v2.3.8`) used consistently.

**Known external prerequisites (not plan failures, flagged for the operator):**
- Task 4 (OSV-Scanner) scheduled SARIF upload to the Security tab needs GitHub code scanning (GitHub Advanced Security on a private repo); otherwise set `upload-sarif: false`. The PR-diff check works regardless.
- Task 6 (Renovate) needs a `RENOVATE_TOKEN` secret before its CI run succeeds.
- Tasks 2-6 GitHub-side runs are verified only after a push (which needs explicit approval); local command runs are the in-plan verification.
- Task 7 requires a Convex backend redeploy to take effect; Task 9 region is confirmed only post-deploy.

---

**Execution note:** Per CLAUDE.md, each task's "Commit" step produces an uncommitted, reviewable change in practice. Stage and present each task's diff for review; commit only on approval. Do not push.
