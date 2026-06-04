# Convex Backend + Better Auth Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Fas 1 foundation: a Convex backend in the EU with Better Auth workspace tenancy (Admin/Editor), a durable email outbox on Scaleway TEM, the full V1 schema skeleton, a minimal dashboard auth shell, and repo-wide Vitest testing wired into the pre-commit hook.

**Architecture:** `packages/backend` holds the Convex deployment with the Better Auth component in Local Install mode (organization = workspace). Org scoping is enforced at the function boundary with `convex-helpers` custom functions reading membership from the auth component. Email goes through an app-owned outbox table rendered by `packages/email` (React Email) and sent by a Scaleway TEM action.

**Tech Stack:** Convex `^1.35` (EU West region), `@convex-dev/better-auth@0.12.2`, `better-auth@1.6.14`, `convex-helpers`, Vitest 4 (+ `convex-test`, `@edge-runtime/vm`), React Email, Scaleway TEM REST API, Next.js 16, Turborepo 2.9, Bun 1.2, Biome.

**Spec:** `docs/superpowers/specs/2026-06-04-convex-backend-better-auth-design.md`. Read it before starting. The spec's Risks section lists the open upstream bugs this plan designs around (#157, #222, #235).

**Conventions for every task:**
- Code style matches Biome config: no semicolons (`asNeeded`), double quotes, 2-space indent.
- All commands run from the repo root unless the step says otherwise. Use `bun run test`, never `bun test`.
- Commit messages use conventional prefixes. The pre-commit hook must pass; never `--no-verify`.
- If a verbatim API in this plan disagrees with the current official docs at implementation time, the docs win; note the deviation in the commit message. Key doc pages are linked in the relevant tasks.

---

## Task 1: Shared Vitest config package

**Files:**
- Create: `packages/vitest-config/package.json`
- Create: `packages/vitest-config/src/base.ts`
- Create: `packages/vitest-config/src/react.ts`

- [ ] **Step 1: Create the package manifest**

```json
{
  "name": "@workspace/vitest-config",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "exports": {
    "./base": "./src/base.ts",
    "./react": "./src/react.ts"
  },
  "dependencies": {
    "vitest": "^4.1.0"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^4.1.0",
    "happy-dom": "^20.10.0"
  }
}
```

- [ ] **Step 2: Create the base preset** (`packages/vitest-config/src/base.ts`)

```ts
import { defineConfig } from "vitest/config"

// Shared defaults for every package. Per-package configs use
// mergeConfig(baseConfig, defineProject({ ... })).
export const baseConfig = defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/_generated/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
})
```

- [ ] **Step 3: Create the react preset** (`packages/vitest-config/src/react.ts`)

```ts
import { mergeConfig } from "vitest/config"
import { baseConfig } from "./base"

// For packages/apps that test React components with Testing Library.
export const reactConfig = mergeConfig(baseConfig, {
  test: {
    environment: "happy-dom",
  },
})
```

- [ ] **Step 4: Install and verify resolution**

Run: `bun install`
Expected: lockfile updates, no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/vitest-config bun.lock
git commit -m "chore: add shared @workspace/vitest-config package"
```

---

## Task 2: Turbo test task + i18n message parity test

The first real test: every locale file must have exactly the key set of `en.json` (CLAUDE.md rule, enforced instead of trusted).

**Files:**
- Modify: `turbo.json`
- Modify: `package.json` (root)
- Modify: `packages/i18n/package.json`
- Create: `packages/i18n/vitest.config.ts`
- Create: `packages/i18n/src/messages.test.ts`

- [ ] **Step 1: Add test tasks to `turbo.json`**

Add to the `tasks` object (keep existing tasks unchanged):

```json
"test": {
  "outputs": ["coverage/**"]
},
"test:watch": {
  "cache": false,
  "persistent": true
}
```

- [ ] **Step 2: Add root test script**

In root `package.json` `scripts`, add:

```json
"test": "turbo test"
```

- [ ] **Step 3: Write the failing parity test** (`packages/i18n/src/messages.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import da from "../messages/da.json"
import en from "../messages/en.json"
import fi from "../messages/fi.json"
import nb from "../messages/nb.json"
import sv from "../messages/sv.json"

// en.json is the base message file; every other locale must mirror its keys
// exactly (the type system only catches keys missing from en).
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === "object") {
      return flattenKeys(value as Record<string, unknown>, path)
    }
    return [path]
  })
}

const locales = { da, fi, nb, sv } as const
const enKeys = flattenKeys(en).sort()

describe("message file parity", () => {
  for (const [locale, messages] of Object.entries(locales)) {
    it(`${locale}.json has exactly the keys of en.json`, () => {
      expect(flattenKeys(messages).sort()).toEqual(enKeys)
    })
  }
})
```

- [ ] **Step 4: Add vitest config and script to packages/i18n**

Create `packages/i18n/vitest.config.ts`:

```ts
import { defineProject, mergeConfig } from "vitest/config"
import { baseConfig } from "@workspace/vitest-config/base"

export default mergeConfig(baseConfig, defineProject({}))
```

In `packages/i18n/package.json`: add `"test": "vitest run"` to `scripts`, and add to `devDependencies`:

```json
"@workspace/vitest-config": "workspace:*",
"vitest": "^4.1.0"
```

Run: `bun install`

- [ ] **Step 5: Run the test**

Run: `bun run test`
Expected: turbo runs `test` in `@workspace/i18n`; parity tests PASS (locales are currently in sync). If a locale drifted, fix the locale file, not the test.

- [ ] **Step 6: Verify turbo caching works**

Run: `bun run test` again.
Expected: `cache hit, replaying logs` and `FULL TURBO` (this is what keeps the pre-commit hook fast).

- [ ] **Step 7: Commit**

```bash
git add turbo.json package.json packages/i18n bun.lock
git commit -m "test: add turbo test task and i18n message parity test"
```

---

## Task 3: Pre-commit hook runs all tests

**Files:**
- Modify: `.githooks/pre-commit`

- [ ] **Step 1: Append the test stage**

In `.githooks/pre-commit`, after the typecheck block and before `echo "pre-commit: OK"`, insert:

```bash
echo "pre-commit: tests (turbo cache-backed)..."
if ! bun run test; then
  echo ""
  echo "pre-commit: tests failed."
  exit 1
fi
```

Rationale (verified): turbo hashes the working tree, so this tests exactly what is being committed; unchanged packages replay from cache. Do NOT use `--affected` here: it diffs committed history only and misses staged changes.

- [ ] **Step 2: Verify the hook end to end**

Run: `bash .githooks/pre-commit`
Expected: biome (0 files), typecheck cached, tests cached or green, `pre-commit: OK`.

- [ ] **Step 3: Commit (the hook exercises itself)**

```bash
git add .githooks/pre-commit
git commit -m "chore: run all tests in the pre-commit hook"
```

---

## Task 4: packages/core skeleton + importance scale (TDD)

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/vitest.config.ts`
- Create: `packages/core/src/importance.ts`
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/index.ts`
- Test: `packages/core/src/importance.test.ts`

- [ ] **Step 1: Scaffold the package**

`packages/core/package.json`:

```json
{
  "name": "@workspace/core",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "biome lint .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "@workspace/vitest-config": "workspace:*",
    "typescript": "^5",
    "vitest": "^4.1.0"
  }
}
```

`packages/core/tsconfig.json`:

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

`packages/core/vitest.config.ts`:

```ts
import { defineProject, mergeConfig } from "vitest/config"
import { baseConfig } from "@workspace/vitest-config/base"

export default mergeConfig(baseConfig, defineProject({}))
```

Run: `bun install`

- [ ] **Step 2: Write the failing tests** (`packages/core/src/importance.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import {
  IMPORTANCE_LEVELS,
  IMPORTANCE_SCALE,
  weightForImportance,
} from "./importance"

// The importance scale is FIXED (7 levels). Users pick a label; the engine
// resolves the hidden weight. Level 7 = highest importance = weight 18.
describe("IMPORTANCE_SCALE", () => {
  it("has exactly 7 levels, 1 through 7", () => {
    expect(IMPORTANCE_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("maps levels to the fixed Excel weights", () => {
    expect(IMPORTANCE_SCALE).toEqual({
      1: 8,
      2: 10,
      3: 11,
      4: 12,
      5: 13,
      6: 14,
      7: 18,
    })
  })

  it("weights are strictly ascending with importance", () => {
    const weights = IMPORTANCE_LEVELS.map((l) => IMPORTANCE_SCALE[l])
    const sorted = [...weights].sort((a, b) => a - b)
    expect(weights).toEqual(sorted)
    expect(new Set(weights).size).toBe(7)
  })

  it("weightForImportance resolves a level to its weight", () => {
    expect(weightForImportance(7)).toBe(18)
    expect(weightForImportance(1)).toBe(8)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/core && bun run test`
Expected: FAIL, cannot resolve `./importance`.

- [ ] **Step 4: Implement** (`packages/core/src/importance.ts`)

```ts
// The fixed 7-level importance scale (betydelseskala). HR always picks a
// label on this scale; the numeric weight is internal and never shown to
// users. See docs/contexts/evaluation-model/standardmall.md.
export const IMPORTANCE_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const

export type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number]

export const IMPORTANCE_SCALE: Readonly<Record<ImportanceLevel, number>> = {
  1: 8,
  2: 10,
  3: 11,
  4: 12,
  5: 13,
  6: 14,
  7: 18,
}

export function weightForImportance(level: ImportanceLevel): number {
  return IMPORTANCE_SCALE[level]
}
```

`packages/core/src/types.ts`:

```ts
import type { ImportanceLevel } from "./importance"

// A rating is the raw 0-5 an assessor gives a role on a criterion.
export type RatingValue = 0 | 1 | 2 | 3 | 4 | 5

// Band 1 is the HIGHEST band. Higher band number = lower weight.
export type Band = number

export const TRACK_KEYS = ["IC", "Lead", "M"] as const
export type TrackKey = (typeof TRACK_KEYS)[number]

export interface CriterionWeight {
  criterionId: string
  importanceLevel: ImportanceLevel
}
```

`packages/core/src/index.ts`:

```ts
export * from "./importance"
export * from "./types"
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && bun run test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core bun.lock
git commit -m "feat(core): add pure domain package with fixed importance scale"
```

---

## Task 5: packages/backend scaffold + Convex EU provisioning

**Files:**
- Create: `packages/backend/package.json`
- Create: `packages/backend/tsconfig.json`
- Create: `packages/backend/vitest.config.ts`
- Create: `packages/backend/convex/schema.ts`
- Modify: `biome.json`
- Modify: `.gitignore` (root)

- [ ] **Step 1: REQUIRES USER, do this first: provision in the EU**

The region choice is per deployment and irreversible. In the Convex dashboard (dashboard.convex.dev), the founder must, in this order:
1. Create/verify the team, then in team settings set the default region to EU West (Ireland).
2. Only after that will the CLI-created project and dev deployments land in the EU.

Suggest the user runs the interactive login themselves: `! cd packages/backend && bunx convex dev --once --configure new` (after Step 2 below creates the package). Afterwards verify in the dashboard that the dev deployment's region shows EU West (Ireland). If it shows US East, stop: delete the project, fix the team default, recreate.

- [ ] **Step 2: Scaffold the package**

`packages/backend/package.json`:

```json
{
  "name": "@workspace/backend",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "convex dev",
    "setup": "convex dev --until-success",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit -p convex",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@workspace/core": "workspace:*",
    "convex": "^1.35.0",
    "convex-helpers": "^0.1.100"
  },
  "devDependencies": {
    "@edge-runtime/vm": "^5.0.0",
    "@workspace/typescript-config": "workspace:*",
    "@workspace/vitest-config": "workspace:*",
    "convex-test": "^0.0.53",
    "typescript": "^5",
    "vitest": "^4.1.0"
  }
}
```

Pin `convex-helpers` to its current latest at implementation time (check `bun info convex-helpers version`).

`packages/backend/tsconfig.json`:

```json
{
  "extends": "@workspace/typescript-config/base.json",
  "include": ["convex"],
  "exclude": ["node_modules"]
}
```

`packages/backend/vitest.config.ts` (verified shape for convex-test):

```ts
import { defineProject, mergeConfig } from "vitest/config"
import { baseConfig } from "@workspace/vitest-config/base"

export default mergeConfig(
  baseConfig,
  defineProject({
    test: {
      environment: "edge-runtime",
      server: { deps: { inline: ["convex-test"] } },
    },
  })
)
```

`packages/backend/convex/schema.ts` (empty start):

```ts
import { defineSchema } from "convex/server"

export default defineSchema({})
```

Run: `bun install`

- [ ] **Step 3: Initialize the deployment and codegen**

Run: `cd packages/backend && bunx convex dev --once` (after the user completed Step 1's interactive configure).
Expected: schema pushed, `convex/_generated/` created, and `packages/backend/.env.local` written by the CLI (contains `CONVEX_DEPLOYMENT` and the deployment URL). Verify `.env.local` is gitignored before committing.

- [ ] **Step 4: Biome and git hygiene**

In `biome.json` `files.includes`, add two entries at the end of the array (the glob also covers the local component's nested `betterAuth/_generated`):

```json
"!packages/backend/convex/**/_generated",
"!packages/backend/convex/betterAuth/generatedSchema.ts"
```

In root `.gitignore`, ensure `.env.local` and `coverage/` are ignored (add if missing). `convex/_generated/` is committed BY DESIGN (typecheck needs it); do not ignore it.

- [ ] **Step 5: Wire typecheck and verify**

Run: `bun run typecheck`
Expected: `@workspace/backend` appears in the turbo run and passes.

- [ ] **Step 6: Commit**

```bash
git add packages/backend biome.json .gitignore bun.lock
git commit -m "feat(backend): scaffold Convex package with EU deployment"
```

---

## Task 6: Better Auth Local Install (org plugin, Admin/Editor)

Docs to keep open: https://labs.convex.dev/better-auth (installation, features/local-install) and https://www.better-auth.com/docs/plugins/organization. The org plugin REQUIRES Local Install (verified; supported-plugins list excludes it).

**Files:**
- Create: `packages/backend/convex/betterAuth/convex.config.ts`
- Create: `packages/backend/convex/betterAuth/auth.ts`
- Create: `packages/backend/convex/betterAuth/permissions.ts`
- Create: `packages/backend/convex/betterAuth/schema.ts` (+ generated `generatedSchema.ts`)
- Create: `packages/backend/convex/betterAuth/adapter.ts`
- Create: `packages/backend/convex/convex.config.ts`
- Create: `packages/backend/convex/auth.ts`
- Create: `packages/backend/convex/auth.config.ts`
- Create: `packages/backend/convex/http.ts`

- [ ] **Step 1: Install auth dependencies**

Run: `cd packages/backend && bun add better-auth@1.6.14 @convex-dev/better-auth@0.12.2`
Expected: exact versions in package.json. NEVER bump better-auth past `<1.7.0` (peer pin of the component).

- [ ] **Step 2: Define the access control (Admin/Editor)** (`convex/betterAuth/permissions.ts`)

```ts
import { createAccessControl } from "better-auth/plugins/access"
import {
  adminAc,
  defaultStatements,
} from "better-auth/plugins/organization/access"

// Admin: configures the model and manages members (owner-equivalent).
// Editor: registers roles and enters ratings; cannot touch configuration.
// Resources beyond Better Auth's defaults are our domain resources; later
// slices consume these statements (model = evaluation model config).
export const statement = {
  ...defaultStatements,
  model: ["update"],
  role: ["create", "read", "update", "archive"],
  rating: ["create", "read", "update"],
} as const

export const ac = createAccessControl(statement)

export const admin = ac.newRole({
  ...adminAc.statements,
  model: ["update"],
  role: ["create", "read", "update", "archive"],
  rating: ["create", "read", "update"],
})

export const editor = ac.newRole({
  role: ["create", "read", "update", "archive"],
  rating: ["create", "read", "update"],
})
```

- [ ] **Step 3: Create the local component config** (`convex/betterAuth/convex.config.ts`)

```ts
import { defineComponent } from "convex/server"

const component = defineComponent("betterAuth")

export default component
```

And mount it from the app (`convex/convex.config.ts`):

```ts
import { defineApp } from "convex/server"
import betterAuth from "./betterAuth/convex.config"

const app = defineApp()
app.use(betterAuth)

export default app
```

- [ ] **Step 4: Create the auth options and instance** (`convex/auth.ts`)

```ts
import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal"
import { organization } from "better-auth/plugins"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"
import authSchema from "./betterAuth/schema"
import { ac, admin, editor } from "./betterAuth/permissions"

const siteUrl = process.env.SITE_URL ?? ""

const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: { schema: authSchema },
    authFunctions,
    triggers: {
      // Wired in Task 8 (users mirror + workspace profile seed).
    },
  }
)

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
  return {
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // Flipped to true in Task 12 when the email outbox exists.
      requireEmailVerification: false,
    },
    plugins: [
      organization({
        ac,
        roles: { admin, editor },
        creatorRole: "admin",
      }),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx))
```

`convex/auth.config.ts`:

```ts
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config"
import type { AuthConfig } from "convex/server"

export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig
```

`convex/http.ts`:

```ts
import { httpRouter } from "convex/server"
import { authComponent, createAuth } from "./auth"

const http = httpRouter()

authComponent.registerRoutes(http, createAuth)

export default http
```

- [ ] **Step 5: Generate the auth schema (org tables included)**

Create the static instance the CLI needs (`convex/betterAuth/auth.ts`):

```ts
// Static auth instance used ONLY by `npx auth generate` for schema
// generation. Runtime code uses createAuth(ctx) from ../auth.
import { createAuth } from "../auth"

export const auth = createAuth({} as never)
```

Run: `cd packages/backend/convex/betterAuth && bunx auth generate --output generatedSchema.ts`
Expected: `generatedSchema.ts` containing `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation` tables. Verify the org tables are present; if not, the organization plugin is not being picked up from the static instance, check the import chain.

Then create our own `convex/betterAuth/schema.ts` that restores the dropped member index (upstream bug get-convex/better-auth#157):

```ts
import { defineSchema } from "convex/server"
import generatedSchema from "./generatedSchema"

// generatedSchema.ts is overwritten by `bunx auth generate`; custom indexes
// live here so regeneration never loses them.
export default defineSchema({
  ...generatedSchema.tables,
  member: generatedSchema.tables.member.index("organizationId_userId", [
    "organizationId",
    "userId",
  ]),
})
```

If chaining `.index()` on a generated table errors at push time, fall back to the local-install doc's current recommendation for custom indexes (https://labs.convex.dev/better-auth/features/local-install) and note the deviation.

- [ ] **Step 6: Create the adapter** (`convex/betterAuth/adapter.ts`)

```ts
import { createApi } from "@convex-dev/better-auth"
import { createAuthOptions } from "../auth"
import schema from "./schema"

export const {
  create,
  findOne,
  findMany,
  updateOne,
  updateMany,
  deleteOne,
  deleteMany,
} = createApi(schema, createAuthOptions)
```

- [ ] **Step 7: Set deployment env vars and push**

Run (from `packages/backend`):

```bash
bunx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bunx convex env set SITE_URL http://localhost:3001
bunx convex dev --once
```

Expected: push succeeds, component tables visible in the dashboard under the betterAuth component. (`3001`: the dashboard app port; `apps/web` uses 3000.)

- [ ] **Step 8: Typecheck and commit**

Run: `bun run typecheck`
Expected: PASS.

```bash
git add packages/backend bun.lock
git commit -m "feat(backend): add Better Auth local install with organization plugin and Admin/Editor roles"
```

---

## Task 7: convex-test harness + membership component query (TDD)

**Files:**
- Create: `packages/backend/convex/testing.helpers.ts`
- Create: `packages/backend/convex/betterAuth/membership.ts`
- Create: `packages/backend/convex/betterAuth/testing.ts`
- Test: `packages/backend/convex/betterAuth/membership.test.ts`

- [ ] **Step 1: Create the shared test harness** (`convex/testing.helpers.ts`)

```ts
/// <reference types="vite/client" />
import { convexTest } from "convex-test"
import authSchema from "./betterAuth/schema"
import schema from "./schema"

// Register the LOCAL betterAuth component with OUR generated schema.
// Do not use @convex-dev/better-auth/test: it registers the package's
// bundled schema, which does not include our org tables/indexes.
export function initConvexTest() {
  const t = convexTest(schema, import.meta.glob("./**/*.ts"))
  t.registerComponent(
    "betterAuth",
    authSchema,
    import.meta.glob("./betterAuth/**/*.ts")
  )
  return t
}
```

Doc check at implementation time: confirm `t.registerComponent`'s exact signature against the convex-test README (it is `(componentPath, schema, glob)` as of 0.0.53).

- [ ] **Step 2: Write the failing membership test** (`convex/betterAuth/membership.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

describe("membership.getMembership", () => {
  it("returns the role for an org member and null for others", async () => {
    const t = initConvexTest()

    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role: "editor" }
    )

    const member = await t.query(
      components.betterAuth.membership.getMembership,
      { organizationId: orgId, userId }
    )
    expect(member).toEqual({ role: "editor", userId, organizationId: orgId })

    const outsider = await t.query(
      components.betterAuth.membership.getMembership,
      { organizationId: orgId, userId: "someone-else" }
    )
    expect(outsider).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd packages/backend && bun run test`
Expected: FAIL (membership/testing modules missing).

- [ ] **Step 4: Implement the component query** (`convex/betterAuth/membership.ts`)

```ts
import { v } from "convex/values"
import { query } from "./_generated/server"

// Component function: never internet-exposed, called from the app via
// ctx.runQuery(components.betterAuth.membership.getMembership, ...).
// Cross-component calls require an explicit return validator.
export const getMembership = query({
  args: { organizationId: v.string(), userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      organizationId: v.string(),
      userId: v.string(),
      role: v.string(),
    })
  ),
  handler: async (ctx, { organizationId, userId }) => {
    const member = await ctx.db
      .query("member")
      .withIndex("organizationId_userId", (q) =>
        q.eq("organizationId", organizationId).eq("userId", userId)
      )
      .unique()
    if (member === null) return null
    return {
      organizationId: member.organizationId,
      userId: member.userId,
      role: member.role,
    }
  },
})
```

Note: the component has its own `_generated` (created on push for local-install components). If `./_generated/server` does not exist yet, run `cd packages/backend && bunx convex dev --once` first.

And the test seed helper (`convex/betterAuth/testing.ts`):

```ts
import { v } from "convex/values"
import { mutation } from "./_generated/server"

// Test-only seeding. Lives inside the component so it can write the auth
// tables directly; component functions are never internet-exposed, and this
// one is additionally only called from convex-test.
export const seedMembership = mutation({
  args: { email: v.string(), name: v.string(), role: v.string() },
  returns: v.object({ orgId: v.string(), userId: v.string() }),
  handler: async (ctx, { email, name, role }) => {
    const now = Date.now()
    const userId = await ctx.db.insert("user", {
      email,
      name,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })
    const orgId = await ctx.db.insert("organization", {
      name: "Acme",
      slug: `acme-${now}`,
      createdAt: now,
    })
    await ctx.db.insert("member", {
      organizationId: orgId,
      userId,
      role,
      createdAt: now,
    })
    return { orgId, userId }
  },
})
```

Field names must match `generatedSchema.ts` exactly; open it and adjust required fields if generation produced a different shape (it is the source of truth).

- [ ] **Step 5: Run to verify pass**

Run: `cd packages/backend && bun run test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/backend
git commit -m "test(backend): add convex-test harness and membership component query"
```

---

## Task 8: Users mirror + workspace profile seed via triggers (TDD)

Trigger handlers are plain functions in `convex/accounts/mirrors.ts`, unit-tested directly via `t.run`, then wired into `createClient`. Verified semantics: triggers run in the same transaction as the auth write, but a multi-write auth endpoint has no cross-operation atomicity, so handlers must be idempotent.

**Files:**
- Create: `packages/backend/convex/accounts/tables.ts`
- Create: `packages/backend/convex/accounts/mirrors.ts`
- Modify: `packages/backend/convex/schema.ts`
- Modify: `packages/backend/convex/auth.ts` (triggers wiring)
- Test: `packages/backend/convex/accounts/mirrors.test.ts`

- [ ] **Step 1: Add the app-side tables** (`convex/accounts/tables.ts`)

```ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// Thin mirror of Better Auth users (authId = Better Auth user id). Holds
// app-side per-user settings (locale) and gives audit log a join target.
export const users = defineTable({
  authId: v.string(),
  name: v.string(),
  email: v.string(),
  locale: v.optional(v.string()),
}).index("by_auth_id", ["authId"])

// One per workspace (orgId = Better Auth organization id). Seeded empty on
// org creation; the company-setup form fills it in a later slice.
export const workspaceProfiles = defineTable({
  orgId: v.string(),
  country: v.optional(v.string()),
  currency: v.optional(v.string()),
  language: v.optional(v.string()),
  employeeCount: v.optional(v.number()),
  businessType: v.optional(v.string()),
}).index("by_org", ["orgId"])
```

Compose in `convex/schema.ts`:

```ts
import { defineSchema } from "convex/server"
import { users, workspaceProfiles } from "./accounts/tables"

export default defineSchema({
  users,
  workspaceProfiles,
})
```

- [ ] **Step 2: Write the failing tests** (`convex/accounts/mirrors.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { initConvexTest } from "../testing.helpers"
import {
  onOrganizationCreate,
  onUserCreate,
  onUserDelete,
  onUserUpdate,
} from "./mirrors"

const authUser = {
  _id: "ba_user_1",
  _creationTime: 0,
  email: "hr@acme.se",
  name: "HR Person",
}

describe("user mirror triggers", () => {
  it("onUserCreate inserts a mirror row, idempotently", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserCreate(ctx, authUser) // second run must not duplicate
      const rows = await ctx.db.query("users").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        authId: "ba_user_1",
        email: "hr@acme.se",
        name: "HR Person",
      })
    })
  })

  it("onUserUpdate patches name and email", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserUpdate(ctx, { ...authUser, name: "Renamed" }, authUser)
      const row = await ctx.db
        .query("users")
        .withIndex("by_auth_id", (q) => q.eq("authId", "ba_user_1"))
        .unique()
      expect(row?.name).toBe("Renamed")
    })
  })

  it("onUserDelete removes the mirror row", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onUserCreate(ctx, authUser)
      await onUserDelete(ctx, authUser)
      expect(await ctx.db.query("users").collect()).toHaveLength(0)
    })
  })

  it("onOrganizationCreate seeds an empty profile, idempotently", async () => {
    const t = initConvexTest()
    const org = { _id: "ba_org_1", _creationTime: 0, name: "Acme" }
    await t.run(async (ctx) => {
      await onOrganizationCreate(ctx, org)
      await onOrganizationCreate(ctx, org)
      const rows = await ctx.db.query("workspaceProfiles").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].orgId).toBe("ba_org_1")
    })
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd packages/backend && bun run test`
Expected: FAIL (mirrors module missing; schema tables missing).

- [ ] **Step 4: Implement the handlers** (`convex/accounts/mirrors.ts`)

```ts
import type { GenericMutationCtx } from "convex/server"
import type { DataModel } from "../_generated/dataModel"

type Ctx = GenericMutationCtx<DataModel>

interface AuthUserDoc {
  _id: string
  email: string
  name: string
}

interface AuthOrgDoc {
  _id: string
}

// All handlers are idempotent: a Better Auth endpoint can perform several
// writes and only the triggering operation rolls back on error.
export async function onUserCreate(ctx: Ctx, doc: AuthUserDoc) {
  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("users", {
    authId: doc._id,
    name: doc.name,
    email: doc.email,
  })
}

export async function onUserUpdate(
  ctx: Ctx,
  newDoc: AuthUserDoc,
  _oldDoc: AuthUserDoc
) {
  const row = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", newDoc._id))
    .unique()
  if (row === null) {
    await onUserCreate(ctx, newDoc)
    return
  }
  await ctx.db.patch(row._id, { name: newDoc.name, email: newDoc.email })
}

export async function onUserDelete(ctx: Ctx, doc: AuthUserDoc) {
  const row = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", doc._id))
    .unique()
  if (row !== null) await ctx.db.delete(row._id)
}

export async function onOrganizationCreate(ctx: Ctx, doc: AuthOrgDoc) {
  const existing = await ctx.db
    .query("workspaceProfiles")
    .withIndex("by_org", (q) => q.eq("orgId", doc._id))
    .unique()
  if (existing !== null) return
  await ctx.db.insert("workspaceProfiles", { orgId: doc._id })
}
```

Wire into `convex/auth.ts` by replacing the empty `triggers: {}` block:

```ts
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          await onUserCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onUserUpdate(ctx, newDoc, oldDoc)
        },
        onDelete: async (ctx, doc) => {
          await onUserDelete(ctx, doc)
        },
      },
      organization: {
        onCreate: async (ctx, doc) => {
          await onOrganizationCreate(ctx, doc)
        },
      },
    },
```

with the import `import { onOrganizationCreate, onUserCreate, onUserDelete, onUserUpdate } from "./accounts/mirrors"`. Rename the local trigger imports if they collide with the exported `onCreate/onUpdate/onDelete` from `triggersApi()` (keep the exported names exactly `onCreate`, `onUpdate`, `onDelete`: the component requires them).

- [ ] **Step 5: Run to verify pass, push, commit**

Run: `cd packages/backend && bun run test && bunx convex dev --once`
Expected: tests PASS, push succeeds.

```bash
git add packages/backend
git commit -m "feat(backend): mirror auth users and seed workspace profiles via triggers"
```

---

## Task 9: Error codes + org-scoping wrappers (TDD)

The heart of tenant isolation. Every org-scoped public function is built with these wrappers; raw `query`/`mutation` are reserved for non-tenant code.

**Files:**
- Create: `packages/backend/convex/lib/errors.ts`
- Create: `packages/backend/convex/lib/functions.ts`
- Create: `packages/backend/convex/accounts/context.ts`
- Test: `packages/backend/convex/lib/functions.test.ts`

- [ ] **Step 1: Define error codes** (`convex/lib/errors.ts`)

```ts
import { ConvexError } from "convex/values"

// Machine-readable codes. The backend NEVER returns display text; the
// frontend maps these codes to i18n messages (errors.* keys exist in
// packages/i18n message files).
export const ERROR_CODES = {
  notAuthenticated: "errors.notAuthenticated",
  notAMember: "errors.notAMember",
  adminRequired: "errors.adminRequired",
  notFound: "errors.notFound",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export function appError(code: ErrorCode): ConvexError<{ code: ErrorCode }> {
  return new ConvexError({ code })
}
```

- [ ] **Step 2: Write the failing wrapper tests** (`convex/lib/functions.test.ts`)

The probe function is `accounts/context.getWorkspaceContext` (a real, useful endpoint), plus a probe `adminMutation` (`accounts/context.touchWorkspace`) that does nothing but pass the gate.

```ts
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

async function seed(t: ReturnType<typeof initConvexTest>, role: string) {
  return await t.mutation(components.betterAuth.testing.seedMembership, {
    email: "hr@acme.se",
    name: "HR Person",
    role,
  })
}

describe("org-scoping wrappers", () => {
  it("rejects unauthenticated callers", async () => {
    const t = initConvexTest()
    const { orgId } = await seed(t, "editor")
    await expect(
      t.query(api.accounts.context.getWorkspaceContext, { orgId })
    ).rejects.toThrow(/errors.notAuthenticated/)
  })

  it("rejects authenticated non-members", async () => {
    const t = initConvexTest()
    const { orgId } = await seed(t, "editor")
    const asOutsider = t.withIdentity({ subject: "not-a-member" })
    await expect(
      asOutsider.query(api.accounts.context.getWorkspaceContext, { orgId })
    ).rejects.toThrow(/errors.notAMember/)
  })

  it("rejects members of a DIFFERENT org (cross-tenant)", async () => {
    const t = initConvexTest()
    const a = await seed(t, "editor")
    const b = await seed(t, "editor")
    const asMemberOfB = t.withIdentity({ subject: b.userId })
    await expect(
      asMemberOfB.query(api.accounts.context.getWorkspaceContext, {
        orgId: a.orgId,
      })
    ).rejects.toThrow(/errors.notAMember/)
  })

  it("returns org context for a member", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "editor")
    const asMember = t.withIdentity({ subject: userId })
    const ctx = await asMember.query(
      api.accounts.context.getWorkspaceContext,
      { orgId }
    )
    expect(ctx).toEqual({ orgId, role: "editor" })
  })

  it("adminMutation rejects editors with errors.adminRequired", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "editor")
    const asEditor = t.withIdentity({ subject: userId })
    await expect(
      asEditor.mutation(api.accounts.context.touchWorkspace, { orgId })
    ).rejects.toThrow(/errors.adminRequired/)
  })

  it("adminMutation allows admins", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seed(t, "admin")
    const asAdmin = t.withIdentity({ subject: userId })
    await expect(
      asAdmin.mutation(api.accounts.context.touchWorkspace, { orgId })
    ).resolves.toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify failure**

Run: `cd packages/backend && bun run test`
Expected: FAIL (modules missing).

- [ ] **Step 4: Implement the wrappers** (`convex/lib/functions.ts`)

```ts
import {
  customMutation,
  customQuery,
} from "convex-helpers/server/customFunctions"
import { v } from "convex/values"
import { components } from "../_generated/api"
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server"
import { appError, ERROR_CODES } from "./errors"

export type WorkspaceRole = "admin" | "editor"

interface OrgContext {
  orgId: string
  role: WorkspaceRole
  authUserId: string
}

// Resolves identity from the JWT (subject = Better Auth user id) and checks
// membership against the auth component's member table. Deliberately avoids
// authComponent.getAuthUser(): the adapter path does not run under
// convex-test (get-convex/better-auth#235) and the JWT is already validated
// by Convex.
async function resolveOrgContext(
  ctx: QueryCtx | MutationCtx,
  orgId: string
): Promise<OrgContext> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
  const membership = await ctx.runQuery(
    components.betterAuth.membership.getMembership,
    { organizationId: orgId, userId: identity.subject }
  )
  if (membership === null) throw appError(ERROR_CODES.notAMember)
  return {
    orgId,
    role: membership.role as WorkspaceRole,
    authUserId: identity.subject,
  }
}

const orgArgs = { orgId: v.string() }

// Org-scoped read: injects ctx.orgId / ctx.role / ctx.authUserId.
export const orgQuery = customQuery(query, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    return { ctx: org, args: {} }
  },
})

// Org-scoped write (any member role).
export const orgMutation = customMutation(mutation, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    return { ctx: org, args: {} }
  },
})

// Admin-only write (model configuration, member management).
export const adminMutation = customMutation(mutation, {
  args: orgArgs,
  input: async (ctx, { orgId }) => {
    const org = await resolveOrgContext(ctx, orgId)
    if (org.role !== "admin") throw appError(ERROR_CODES.adminRequired)
    return { ctx: org, args: {} }
  },
})
```

Note: if `ctx.runQuery` is not available on plain query ctx for component calls in the installed convex version, import the component client accessor per https://labs.convex.dev/better-auth/features/local-install and note the deviation.

And the probe endpoints (`convex/accounts/context.ts`):

```ts
import { v } from "convex/values"
import { adminMutation, orgQuery } from "../lib/functions"

// Who am I in this workspace? Used by the dashboard shell.
export const getWorkspaceContext = orgQuery({
  args: {},
  returns: v.object({ orgId: v.string(), role: v.string() }),
  handler: async (ctx) => {
    return { orgId: ctx.orgId, role: ctx.role }
  },
})

// Admin-gate probe; exercised by tests until real admin endpoints exist.
export const touchWorkspace = adminMutation({
  args: {},
  returns: v.null(),
  handler: async () => null,
})
```

- [ ] **Step 5: Run to verify pass**

Run: `cd packages/backend && bun run test`
Expected: PASS (all six wrapper tests).

- [ ] **Step 6: Commit**

```bash
git add packages/backend
git commit -m "feat(backend): add error codes and org-scoping function wrappers"
```

---

## Task 10: Workspace profile functions + audit log (TDD)

**Files:**
- Create: `packages/backend/convex/shared/tables.ts`
- Create: `packages/backend/convex/lib/audit.ts`
- Create: `packages/backend/convex/accounts/workspace.ts`
- Modify: `packages/backend/convex/schema.ts`
- Test: `packages/backend/convex/accounts/workspace.test.ts`

- [ ] **Step 1: Add the auditLog table** (`convex/shared/tables.ts`)

```ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// Append-only. actorName is snapshotted at write time so audit rows stay
// truthful if a user is later renamed or deleted.
export const auditLog = defineTable({
  orgId: v.string(),
  type: v.string(),
  actorId: v.string(),
  actorName: v.string(),
  payload: v.any(),
})
  .index("by_org", ["orgId"])
  .index("by_org_type", ["orgId", "type"])
```

Add to `convex/schema.ts` (spread alongside existing tables):

```ts
import { auditLog } from "./shared/tables"
// inside defineSchema({ ... })
  auditLog,
```

- [ ] **Step 2: Add the audit helper** (`convex/lib/audit.ts`)

```ts
import type { MutationCtx } from "../_generated/server"

export const AUDIT_EVENTS = {
  workspaceCreated: "workspace.created",
  workspaceProfileUpdated: "workspace.profileUpdated",
  memberAdded: "member.added",
  memberRoleChanged: "member.roleChanged",
  memberRemoved: "member.removed",
  invitationCreated: "invitation.created",
  invitationAccepted: "invitation.accepted",
  invitationRevoked: "invitation.revoked",
} as const

export type AuditEvent = (typeof AUDIT_EVENTS)[keyof typeof AUDIT_EVENTS]

// Called inside the same mutation transaction as the change it records.
export async function logAudit(
  ctx: MutationCtx,
  entry: {
    orgId: string
    type: AuditEvent
    actorId: string
    payload: Record<string, unknown>
  }
) {
  const actor = await ctx.db
    .query("users")
    .withIndex("by_auth_id", (q) => q.eq("authId", entry.actorId))
    .unique()
  await ctx.db.insert("auditLog", {
    orgId: entry.orgId,
    type: entry.type,
    actorId: entry.actorId,
    actorName: actor?.name ?? "unknown",
    payload: entry.payload,
  })
}
```

- [ ] **Step 3: Write failing tests** (`convex/accounts/workspace.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"
import { onUserCreate } from "./mirrors"

describe("workspace profile", () => {
  async function setup(role: string) {
    const t = initConvexTest()
    const { orgId, userId } = await t.mutation(
      components.betterAuth.testing.seedMembership,
      { email: "hr@acme.se", name: "HR Person", role }
    )
    await t.run(async (ctx) => {
      await onUserCreate(ctx, {
        _id: userId,
        email: "hr@acme.se",
        name: "HR Person",
      })
      await ctx.db.insert("workspaceProfiles", { orgId })
    })
    return { t, orgId, userId }
  }

  it("getWorkspaceProfile returns the profile for members", async () => {
    const { t, orgId, userId } = await setup("editor")
    const asMember = t.withIdentity({ subject: userId })
    const profile = await asMember.query(
      api.accounts.workspace.getWorkspaceProfile,
      { orgId }
    )
    expect(profile).toMatchObject({ orgId, country: null })
  })

  it("updateWorkspaceProfile is admin-only and audited", async () => {
    const { t, orgId, userId } = await setup("admin")
    const asAdmin = t.withIdentity({ subject: userId })
    await asAdmin.mutation(api.accounts.workspace.updateWorkspaceProfile, {
      orgId,
      country: "SE",
      currency: "SEK",
      language: "sv",
    })
    await t.run(async (ctx) => {
      const profile = await ctx.db
        .query("workspaceProfiles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      expect(profile).toMatchObject({ country: "SE", currency: "SEK" })
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "workspace.profileUpdated")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].actorName).toBe("HR Person")
    })
  })

  it("updateWorkspaceProfile rejects editors", async () => {
    const { t, orgId, userId } = await setup("editor")
    const asEditor = t.withIdentity({ subject: userId })
    await expect(
      asEditor.mutation(api.accounts.workspace.updateWorkspaceProfile, {
        orgId,
        country: "SE",
      })
    ).rejects.toThrow(/errors.adminRequired/)
  })
})
```

- [ ] **Step 4: Run to verify failure, then implement** (`convex/accounts/workspace.ts`)

Run: `cd packages/backend && bun run test` (expect FAIL), then:

```ts
import { v } from "convex/values"
import { appError, ERROR_CODES } from "../lib/errors"
import { adminMutation, orgQuery } from "../lib/functions"
import { AUDIT_EVENTS, logAudit } from "../lib/audit"

const profileShape = v.object({
  orgId: v.string(),
  country: v.union(v.string(), v.null()),
  currency: v.union(v.string(), v.null()),
  language: v.union(v.string(), v.null()),
  employeeCount: v.union(v.number(), v.null()),
  businessType: v.union(v.string(), v.null()),
})

export const getWorkspaceProfile = orgQuery({
  args: {},
  returns: profileShape,
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("workspaceProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (profile === null) throw appError(ERROR_CODES.notFound)
    return {
      orgId: profile.orgId,
      country: profile.country ?? null,
      currency: profile.currency ?? null,
      language: profile.language ?? null,
      employeeCount: profile.employeeCount ?? null,
      businessType: profile.businessType ?? null,
    }
  },
})

export const updateWorkspaceProfile = adminMutation({
  args: {
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
    language: v.optional(v.string()),
    employeeCount: v.optional(v.number()),
    businessType: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("workspaceProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .unique()
    if (profile === null) throw appError(ERROR_CODES.notFound)
    await ctx.db.patch(profile._id, args)
    await logAudit(ctx, {
      orgId: ctx.orgId,
      type: AUDIT_EVENTS.workspaceProfileUpdated,
      actorId: ctx.authUserId,
      payload: { changed: Object.keys(args) },
    })
    return null
  },
})
```

- [ ] **Step 5: Audit workspace/member lifecycle from triggers (TDD)**

The spec's V1 audit events (`workspace.created`, `member.added`, `member.roleChanged`, `member.removed`, `invitation.created/accepted/revoked`) fire from auth-component writes, so they are logged from triggers. Add failing tests to `convex/accounts/mirrors.test.ts`:

```ts
import {
  onInvitationCreate,
  onInvitationUpdate,
  onMemberCreate,
  onMemberDelete,
  onMemberUpdate,
} from "./mirrors"

describe("lifecycle audit triggers", () => {
  const member = {
    _id: "ba_member_1",
    _creationTime: 0,
    organizationId: "ba_org_1",
    userId: "ba_user_1",
    role: "editor",
  }

  it("logs member.added on member create", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onMemberCreate(ctx, member)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "member.added")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].payload).toMatchObject({ role: "editor" })
    })
  })

  it("logs member.roleChanged only when the role changed", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onMemberUpdate(ctx, { ...member, role: "admin" }, member)
      await onMemberUpdate(ctx, member, member) // no change, no log
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "member.roleChanged")
        )
        .collect()
      expect(audit).toHaveLength(1)
      expect(audit[0].payload).toMatchObject({ from: "editor", to: "admin" })
    })
  })

  it("logs member.removed on member delete", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await onMemberDelete(ctx, member)
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "member.removed")
        )
        .collect()
      expect(audit).toHaveLength(1)
    })
  })

  it("logs invitation.created and invitation.accepted", async () => {
    const t = initConvexTest()
    const invitation = {
      _id: "ba_inv_1",
      _creationTime: 0,
      organizationId: "ba_org_1",
      email: "new@acme.se",
      status: "pending",
      inviterId: "ba_user_1",
    }
    await t.run(async (ctx) => {
      await onInvitationCreate(ctx, invitation)
      await onInvitationUpdate(ctx, { ...invitation, status: "accepted" }, invitation)
      const created = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "invitation.created")
        )
        .collect()
      const accepted = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", "ba_org_1").eq("type", "invitation.accepted")
        )
        .collect()
      expect(created).toHaveLength(1)
      expect(accepted).toHaveLength(1)
    })
  })
})
```

Run red, then append to `convex/accounts/mirrors.ts`:

```ts
import { AUDIT_EVENTS, logAudit } from "../lib/audit"

interface AuthMemberDoc {
  _id: string
  organizationId: string
  userId: string
  role: string
}

interface AuthInvitationDoc {
  _id: string
  organizationId?: string | null
  email?: string | null
  status?: string | null
  inviterId?: string | null
}

export async function onMemberCreate(ctx: Ctx, doc: AuthMemberDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberAdded,
    actorId: doc.userId,
    payload: { memberUserId: doc.userId, role: doc.role },
  })
}

export async function onMemberUpdate(
  ctx: Ctx,
  newDoc: AuthMemberDoc,
  oldDoc: AuthMemberDoc
) {
  if (newDoc.role === oldDoc.role) return
  await logAudit(ctx, {
    orgId: newDoc.organizationId,
    type: AUDIT_EVENTS.memberRoleChanged,
    actorId: newDoc.userId,
    payload: { memberUserId: newDoc.userId, from: oldDoc.role, to: newDoc.role },
  })
}

export async function onMemberDelete(ctx: Ctx, doc: AuthMemberDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId,
    type: AUDIT_EVENTS.memberRemoved,
    actorId: doc.userId,
    payload: { memberUserId: doc.userId },
  })
}

export async function onInvitationCreate(ctx: Ctx, doc: AuthInvitationDoc) {
  await logAudit(ctx, {
    orgId: doc.organizationId ?? "unknown",
    type: AUDIT_EVENTS.invitationCreated,
    actorId: doc.inviterId ?? "system",
    payload: { email: doc.email ?? null },
  })
}

export async function onInvitationUpdate(
  ctx: Ctx,
  newDoc: AuthInvitationDoc,
  oldDoc: AuthInvitationDoc
) {
  if (newDoc.status === oldDoc.status) return
  const type =
    newDoc.status === "accepted"
      ? AUDIT_EVENTS.invitationAccepted
      : AUDIT_EVENTS.invitationRevoked
  await logAudit(ctx, {
    orgId: newDoc.organizationId ?? "unknown",
    type,
    actorId: newDoc.inviterId ?? "system",
    payload: { email: newDoc.email ?? null, status: newDoc.status ?? null },
  })
}
```

Also extend `onOrganizationCreate` to log `workspace.created` (actor is unknown inside the org trigger; the creator's member row logs `member.added` in the same flow):

```ts
  await logAudit(ctx, {
    orgId: doc._id,
    type: AUDIT_EVENTS.workspaceCreated,
    actorId: "system",
    payload: {},
  })
```

Wire the new handlers into `convex/auth.ts` `triggers` (alongside the existing `user`/`organization` entries):

```ts
      member: {
        onCreate: async (ctx, doc) => {
          await onMemberCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onMemberUpdate(ctx, newDoc, oldDoc)
        },
        onDelete: async (ctx, doc) => {
          await onMemberDelete(ctx, doc)
        },
      },
      invitation: {
        onCreate: async (ctx, doc) => {
          await onInvitationCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onInvitationUpdate(ctx, newDoc, oldDoc)
        },
      },
```

Adjust the existing `onOrganizationCreate` test for the extra audit row if it asserts row counts. Field shapes for member/invitation docs come from `generatedSchema.ts`; align the interfaces if generation differs.

- [ ] **Step 6: Run to verify pass, push, commit**

Run: `cd packages/backend && bun run test && bunx convex dev --once`

```bash
git add packages/backend
git commit -m "feat(backend): add workspace profile functions and lifecycle audit log"
```

---

## Task 11: packages/email (React Email + locale-aware render)

**Files:**
- Create: `packages/email/package.json`, `tsconfig.json`, `vitest.config.ts`
- Create: `packages/email/src/messages.ts`
- Create: `packages/email/src/templates/invitation.tsx`
- Create: `packages/email/src/templates/verify-email.tsx`
- Create: `packages/email/src/templates/reset-password.tsx`
- Create: `packages/email/src/render.ts`, `packages/email/src/index.ts`
- Modify: `packages/i18n/messages/en.json` (+ sv, nb, da, fi)
- Test: `packages/email/src/render.test.ts`

- [ ] **Step 1: Add the email.* i18n keys**

In `packages/i18n/messages/en.json` add (English first, it is the base):

```json
"email": {
  "invitation": {
    "subject": "{inviterName} invited you to {workspaceName} on blueprnt",
    "heading": "Join {workspaceName}",
    "body": "{inviterName} has invited you to the workspace {workspaceName}.",
    "cta": "Accept invitation"
  },
  "verifyEmail": {
    "subject": "Verify your email address",
    "heading": "Verify your email",
    "body": "Confirm your email address to activate your blueprnt account.",
    "cta": "Verify email"
  },
  "resetPassword": {
    "subject": "Reset your password",
    "heading": "Reset your password",
    "body": "Click the button below to choose a new password.",
    "cta": "Reset password"
  }
}
```

Mirror the same structure into `sv.json`, `nb.json`, `da.json`, `fi.json` with translations (Swedish from the glossaries' tone; nb/da/fi machine-drafted and flagged for native review in the commit message). The Task 2 parity test fails until all five files match.

- [ ] **Step 2: Scaffold the package**

`packages/email/package.json`:

```json
{
  "name": "@workspace/email",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "biome lint .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "preview": "email dev --dir src/templates"
  },
  "dependencies": {
    "@react-email/components": "^0.5.0",
    "@react-email/render": "^1.3.0",
    "@workspace/i18n": "workspace:*",
    "react": "19.2.4"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@workspace/typescript-config": "workspace:*",
    "@workspace/vitest-config": "workspace:*",
    "react-email": "^4.3.0",
    "typescript": "^5",
    "vitest": "^4.1.0"
  }
}
```

Pin `@react-email/*` to current latest at implementation time (`bun info @react-email/components version`). `tsconfig.json` extends `@workspace/typescript-config/react-library.json`, includes `src`. `vitest.config.ts` mirrors packages/core's (node environment; render returns strings, no DOM needed).

- [ ] **Step 3: Locale loader** (`packages/email/src/messages.ts`)

```ts
import da from "@workspace/i18n/messages/da.json"
import en from "@workspace/i18n/messages/en.json"
import fi from "@workspace/i18n/messages/fi.json"
import nb from "@workspace/i18n/messages/nb.json"
import sv from "@workspace/i18n/messages/sv.json"

export const EMAIL_LOCALES = ["en", "sv", "nb", "da", "fi"] as const
export type EmailLocale = (typeof EMAIL_LOCALES)[number]

const all = { da, en, fi, nb, sv }

export type EmailMessages = (typeof en)["email"]

// Unknown locales fall back to English (the base locale).
export function emailMessages(locale: string): EmailMessages {
  if ((EMAIL_LOCALES as readonly string[]).includes(locale)) {
    return all[locale as EmailLocale].email
  }
  return en.email
}

export function fillTemplate(
  text: string,
  params: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? "")
}
```

- [ ] **Step 4: Templates and render**

`packages/email/src/templates/invitation.tsx`:

```tsx
import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components"
import { emailMessages, fillTemplate } from "../messages"

export interface InvitationEmailProps {
  inviterName: string
  workspaceName: string
  acceptUrl: string
  locale: string
}

export function InvitationEmail(props: InvitationEmailProps) {
  const m = emailMessages(props.locale).invitation
  const params = {
    inviterName: props.inviterName,
    workspaceName: props.workspaceName,
  }
  return (
    <Html lang={props.locale}>
      <Preview>{fillTemplate(m.subject, params)}</Preview>
      <Body>
        <Container>
          <Heading as="h1">{fillTemplate(m.heading, params)}</Heading>
          <Text>{fillTemplate(m.body, params)}</Text>
          <Button href={props.acceptUrl}>{m.cta}</Button>
        </Container>
      </Body>
    </Html>
  )
}
```

`packages/email/src/templates/verify-email.tsx`:

```tsx
import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components"
import { emailMessages } from "../messages"

export interface VerifyEmailProps {
  url: string
  locale: string
}

export function VerifyEmail(props: VerifyEmailProps) {
  const m = emailMessages(props.locale).verifyEmail
  return (
    <Html lang={props.locale}>
      <Preview>{m.subject}</Preview>
      <Body>
        <Container>
          <Heading as="h1">{m.heading}</Heading>
          <Text>{m.body}</Text>
          <Button href={props.url}>{m.cta}</Button>
        </Container>
      </Body>
    </Html>
  )
}
```

`packages/email/src/templates/reset-password.tsx`:

```tsx
import {
  Body,
  Button,
  Container,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components"
import { emailMessages } from "../messages"

export interface ResetPasswordEmailProps {
  url: string
  locale: string
}

export function ResetPasswordEmail(props: ResetPasswordEmailProps) {
  const m = emailMessages(props.locale).resetPassword
  return (
    <Html lang={props.locale}>
      <Preview>{m.subject}</Preview>
      <Body>
        <Container>
          <Heading as="h1">{m.heading}</Heading>
          <Text>{m.body}</Text>
          <Button href={props.url}>{m.cta}</Button>
        </Container>
      </Body>
    </Html>
  )
}
```

`packages/email/src/render.ts`:

```ts
import { render } from "@react-email/render"
import { emailMessages, fillTemplate } from "./messages"
import { InvitationEmail, type InvitationEmailProps } from "./templates/invitation"
import { ResetPasswordEmail } from "./templates/reset-password"
import { VerifyEmail } from "./templates/verify-email"

export type EmailTemplateKey = "invitation" | "verifyEmail" | "resetPassword"

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

interface LinkEmailProps {
  url: string
  locale: string
}

export type EmailProps = {
  invitation: InvitationEmailProps
  verifyEmail: LinkEmailProps
  resetPassword: LinkEmailProps
}

export async function renderEmail<K extends EmailTemplateKey>(
  templateKey: K,
  props: EmailProps[K]
): Promise<RenderedEmail> {
  const m = emailMessages(props.locale)
  switch (templateKey) {
    case "invitation": {
      const p = props as InvitationEmailProps
      const element = InvitationEmail(p)
      return {
        subject: fillTemplate(m.invitation.subject, {
          inviterName: p.inviterName,
          workspaceName: p.workspaceName,
        }),
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
    case "verifyEmail": {
      const element = VerifyEmail(props as LinkEmailProps)
      return {
        subject: m.verifyEmail.subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
    default: {
      const element = ResetPasswordEmail(props as LinkEmailProps)
      return {
        subject: m.resetPassword.subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
  }
}
```

`packages/email/src/index.ts` re-exports `renderEmail`, types, and `EMAIL_LOCALES`.

- [ ] **Step 5: Tests** (`packages/email/src/render.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { renderEmail } from "./render"

describe("renderEmail", () => {
  it("renders the invitation email with interpolated values", async () => {
    const result = await renderEmail("invitation", {
      inviterName: "Anna",
      workspaceName: "Acme",
      acceptUrl: "https://app.example.com/accept-invitation/inv_1",
      locale: "en",
    })
    expect(result.subject).toBe("Anna invited you to Acme on blueprnt")
    expect(result.html).toContain("accept-invitation/inv_1")
    expect(result.text).toContain("Acme")
  })

  it("renders Swedish when locale is sv", async () => {
    const result = await renderEmail("verifyEmail", {
      url: "https://x.example/verify",
      locale: "sv",
    })
    expect(result.subject).not.toBe("Verify your email address")
  })

  it("falls back to English for unknown locales", async () => {
    const result = await renderEmail("resetPassword", {
      url: "https://x.example/reset",
      locale: "xx",
    })
    expect(result.subject).toBe("Reset your password")
  })
})
```

Run red first (before Step 3-4 files exist), then green: `cd packages/email && bun run test`.

- [ ] **Step 6: Full check and commit**

Run: `bun install && bun run test && bun run typecheck`
Expected: parity test green across five locales, email tests green.

```bash
git add packages/email packages/i18n bun.lock
git commit -m "feat(email): add React Email package with locale-aware rendering

nb/da/fi email strings are machine-translated drafts pending native review."
```

---

## Task 12: Email outbox + Scaleway TEM sender + auth wiring (TDD)

Doc to verify at implementation time: Scaleway TEM API reference (https://www.scaleway.com/en/developers/api/transactional-email/), endpoint `POST https://api.scaleway.com/transactional-email/v1alpha1/regions/{region}/emails` with header `X-Auth-Token: $SCW_SECRET_KEY`. Adjust the sender if the current docs differ.

**Files:**
- Create: `packages/backend/convex/email/tables.ts`
- Create: `packages/backend/convex/email/outbox.ts`
- Create: `packages/backend/convex/crons.ts`
- Modify: `packages/backend/convex/schema.ts`
- Modify: `packages/backend/convex/auth.ts`
- Modify: `packages/backend/convex/accounts/workspace.ts` (internal profile lookup)
- Modify: `packages/backend/package.json` (add `@workspace/email` dependency)
- Test: `packages/backend/convex/email/outbox.test.ts`

- [ ] **Step 1: Outbox table** (`convex/email/tables.ts`)

```ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// Durable outbox: enqueue is transactional with the triggering write; a
// scheduled action renders + sends. Rows carry recipient PII, so a cron
// deletes sent/failed rows after 30 days (data minimization).
export const emails = defineTable({
  to: v.string(),
  templateKey: v.union(
    v.literal("invitation"),
    v.literal("verifyEmail"),
    v.literal("resetPassword")
  ),
  props: v.any(),
  locale: v.string(),
  status: v.union(
    v.literal("queued"),
    v.literal("sending"),
    v.literal("sent"),
    v.literal("failed")
  ),
  attempts: v.number(),
  providerMessageId: v.optional(v.string()),
  lastError: v.optional(v.string()),
}).index("by_status", ["status"])
```

Add `emails` to `convex/schema.ts`, and `"@workspace/email": "workspace:*"` to backend dependencies (`bun install`).

- [ ] **Step 2: Failing outbox tests** (`convex/email/outbox.test.ts`)

```ts
import { afterEach, describe, expect, it, vi } from "vitest"
import { internal } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function stubFetch(impl: () => Promise<Response>) {
  const spy = vi.fn(impl)
  vi.stubGlobal("fetch", spy)
  return spy
}

const enqueueArgs = {
  to: "invitee@example.com",
  templateKey: "invitation" as const,
  props: {
    inviterName: "Anna",
    workspaceName: "Acme",
    acceptUrl: "https://x.example/accept-invitation/inv_1",
    locale: "en",
  },
  locale: "en",
}

describe("email outbox", () => {
  it("enqueue creates a queued row and schedules delivery", async () => {
    const t = initConvexTest()
    const fetchSpy = stubFetch(async () =>
      Response.json({ emails: [{ id: "scw-123" }] })
    )
    vi.useFakeTimers()
    await t.mutation(internal.email.outbox.enqueueEmail, enqueueArgs)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetchSpy).toHaveBeenCalledOnce()
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("emails").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ status: "sent", attempts: 1 })
      expect(rows[0].providerMessageId).toBe("scw-123")
    })
  })

  it("retries with backoff and marks failed after 3 attempts", async () => {
    const t = initConvexTest()
    const fetchSpy = stubFetch(async () => {
      throw new Error("scaleway down")
    })
    vi.useFakeTimers()
    await t.mutation(internal.email.outbox.enqueueEmail, enqueueArgs)
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetchSpy).toHaveBeenCalledTimes(3)
    await t.run(async (ctx) => {
      const row = (await ctx.db.query("emails").collect())[0]
      expect(row.status).toBe("failed")
      expect(row.attempts).toBe(3)
      expect(row.lastError).toContain("scaleway down")
    })
  })

  it("cleanup deletes old sent rows but keeps queued ones", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("emails", {
        to: "a@x.se",
        templateKey: "invitation",
        props: {},
        locale: "en",
        status: "sent",
        attempts: 1,
      })
      await ctx.db.insert("emails", {
        to: "b@x.se",
        templateKey: "invitation",
        props: {},
        locale: "en",
        status: "queued",
        attempts: 0,
      })
    })
    // Cleanup with cutoff in the future: the sent row qualifies as old.
    await t.mutation(internal.email.outbox.cleanupOldEmails, {
      olderThanMs: -1,
    })
    await t.run(async (ctx) => {
      const rows = await ctx.db.query("emails").collect()
      expect(rows).toHaveLength(1)
      expect(rows[0].status).toBe("queued")
    })
  })
})
```

- [ ] **Step 3: Run to verify failure, then implement** (`convex/email/outbox.ts`)

```ts
import { renderEmail, type EmailTemplateKey } from "@workspace/email"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import {
  internalAction,
  internalMutation,
} from "../_generated/server"

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 30_000, 120_000]
const FROM = "blueprnt <no-reply@blueprnt.se>"

const templateKeyValidator = v.union(
  v.literal("invitation"),
  v.literal("verifyEmail"),
  v.literal("resetPassword")
)

// Transactional with the caller's mutation: an invite that commits always
// has its email row committed with it.
export const enqueueEmail = internalMutation({
  args: {
    to: v.string(),
    templateKey: templateKeyValidator,
    props: v.any(),
    locale: v.string(),
  },
  returns: v.id("emails"),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("emails", {
      ...args,
      status: "queued",
      attempts: 0,
    })
    await ctx.scheduler.runAfter(0, internal.email.outbox.deliver, {
      emailId: id,
    })
    return id
  },
})

export const deliver = internalAction({
  args: { emailId: v.id("emails") },
  returns: v.null(),
  handler: async (ctx, { emailId }) => {
    const email = await ctx.runQuery(internal.email.outbox.getForDelivery, {
      emailId,
    })
    if (email === null || email.status === "sent") return null
    const attempt = email.attempts + 1
    try {
      const rendered = await renderEmail(
        email.templateKey as EmailTemplateKey,
        { ...email.props, locale: email.locale }
      )
      const region = process.env.SCW_REGION ?? "fr-par"
      const response = await fetch(
        `https://api.scaleway.com/transactional-email/v1alpha1/regions/${region}/emails`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Token": process.env.SCW_SECRET_KEY ?? "",
          },
          body: JSON.stringify({
            from: { email: "no-reply@blueprnt.se", name: "blueprnt" },
            to: [{ email: email.to }],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            project_id: process.env.SCW_PROJECT_ID ?? "",
          }),
          signal: AbortSignal.timeout(10_000),
        }
      )
      if (!response.ok) {
        throw new Error(`scaleway ${response.status}: ${await response.text()}`)
      }
      const body = (await response.json()) as { emails?: { id?: string }[] }
      await ctx.runMutation(internal.email.outbox.markSent, {
        emailId,
        attempts: attempt,
        providerMessageId: body.emails?.[0]?.id,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await ctx.runMutation(internal.email.outbox.markFailedAttempt, {
        emailId,
        attempts: attempt,
        lastError: message,
      })
      if (attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          BACKOFF_MS[attempt] ?? 120_000,
          internal.email.outbox.deliver,
          { emailId }
        )
      }
    }
    return null
  },
})

export const getForDelivery = internalMutation({
  args: { emailId: v.id("emails") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { emailId }) => {
    const email = await ctx.db.get(emailId)
    // Never re-send or re-flag an already-sent email.
    if (email === null || email.status === "sent") return null
    await ctx.db.patch(emailId, { status: "sending" })
    return email
  },
})

export const markSent = internalMutation({
  args: {
    emailId: v.id("emails"),
    attempts: v.number(),
    providerMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { emailId, attempts, providerMessageId }) => {
    await ctx.db.patch(emailId, { status: "sent", attempts, providerMessageId })
    return null
  },
})

export const markFailedAttempt = internalMutation({
  args: {
    emailId: v.id("emails"),
    attempts: v.number(),
    lastError: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { emailId, attempts, lastError }) => {
    await ctx.db.patch(emailId, {
      status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
      attempts,
      lastError,
    })
    return null
  },
})

export const cleanupOldEmails = internalMutation({
  args: { olderThanMs: v.number() },
  returns: v.null(),
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - olderThanMs
    for (const status of ["sent", "failed"] as const) {
      const rows = await ctx.db
        .query("emails")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect()
      for (const row of rows) {
        if (row._creationTime < cutoff) await ctx.db.delete(row._id)
      }
    }
    return null
  },
})
```

`convex/crons.ts`:

```ts
import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

crons.interval(
  "cleanup old outbox emails",
  { hours: 24 },
  internal.email.outbox.cleanupOldEmails,
  { olderThanMs: THIRTY_DAYS_MS }
)

export default crons
```

Note for tests: `getForDelivery` is an internalMutation (not query) because it flips status to `sending`. If `renderEmail`'s React JSX fails under edge-runtime in tests, mock `@workspace/email` with `vi.mock` and assert on enqueue/retry mechanics only; note the deviation.

- [ ] **Step 4: Wire auth email callbacks** (modify `convex/auth.ts`)

Add to `createAuthOptions` (import `requireRunMutationCtx` from `@convex-dev/better-auth/utils` and `internal` from `./_generated/api`):

```ts
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await requireRunMutationCtx(ctx).runMutation(
          internal.email.outbox.enqueueEmail,
          {
            to: user.email,
            templateKey: "verifyEmail",
            props: { url },
            locale: "en",
          }
        )
      },
    },
```

change `emailAndPassword` to:

```ts
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await requireRunMutationCtx(ctx).runMutation(
          internal.email.outbox.enqueueEmail,
          {
            to: user.email,
            templateKey: "resetPassword",
            props: { url },
            locale: "en",
          }
        )
      },
    },
```

and extend the `organization()` plugin options:

```ts
      organization({
        ac,
        roles: { admin, editor },
        creatorRole: "admin",
        async sendInvitationEmail(data) {
          const mctx = requireRunMutationCtx(ctx)
          const profile = await mctx.runQuery(
            internal.accounts.workspace.getProfileForOrg,
            { orgId: data.organization.id }
          )
          await mctx.runMutation(internal.email.outbox.enqueueEmail, {
            to: data.email,
            templateKey: "invitation",
            props: {
              inviterName: data.inviter.user.name,
              workspaceName: data.organization.name,
              acceptUrl: `${siteUrl}/accept-invitation/${data.id}`,
            },
            locale: profile?.language ?? "en",
          })
        },
      }),
```

Add the internal lookup to `convex/accounts/workspace.ts`:

```ts
import { internalQuery } from "../_generated/server"

export const getProfileForOrg = internalQuery({
  args: { orgId: v.string() },
  returns: v.union(v.null(), v.object({ language: v.union(v.string(), v.null()) })),
  handler: async (ctx, { orgId }) => {
    const profile = await ctx.db
      .query("workspaceProfiles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique()
    if (profile === null) return null
    return { language: profile.language ?? null }
  },
})
```

User locale for verification/reset emails stays `en` in this slice (the user has no locale preference yet at sign-up time); revisit when account settings land.

- [ ] **Step 5: Set Scaleway env vars (REQUIRES USER)**

The founder creates a Scaleway account + TEM domain (DNS verification for blueprnt.se: SPF, DKIM, MX records per the Scaleway console), then from `packages/backend`:

```bash
bunx convex env set SCW_SECRET_KEY <secret>
bunx convex env set SCW_PROJECT_ID <project-id>
bunx convex env set SCW_REGION fr-par
```

This can land after the code; the outbox fails gracefully (status `failed`, retries exhausted) until creds exist.

- [ ] **Step 6: Run tests, push, commit**

Run: `cd packages/backend && bun run test && bunx convex dev --once && cd ../.. && bun run typecheck`

```bash
git add packages/backend bun.lock
git commit -m "feat(backend): add durable email outbox with Scaleway TEM sender and auth email wiring"
```

---

## Task 13: Domain schema skeleton (evaluationModel, assessment, suggestions)

Tables only; functions arrive in Fas 2/3 slices. Field shapes come from the spec's data model section; keep them in exact sync.

**Files:**
- Create: `packages/backend/convex/evaluationModel/tables.ts`
- Create: `packages/backend/convex/assessment/tables.ts`
- Modify: `packages/backend/convex/shared/tables.ts` (add suggestions)
- Modify: `packages/backend/convex/schema.ts`
- Test: `packages/backend/convex/schema.test.ts`

- [ ] **Step 1: evaluationModel tables** (`convex/evaluationModel/tables.ts`)

```ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// One living model per workspace (V1: no versioning, ADR-0002). Score and
// band are NEVER stored; they are derived by packages/core.
export const models = defineTable({
  orgId: v.string(),
  name: v.string(),
  templateKey: v.optional(v.string()),
}).index("by_org", ["orgId"])

export const criteria = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  name: v.string(),
  description: v.string(),
  helpText: v.string(),
  importanceLevel: v.number(), // 1-7; weight resolved via @workspace/core
  order: v.number(),
  isCustom: v.boolean(),
  // Criterion rationale (kriterieurvalsprotokoll), filled in E2.
  purpose: v.optional(v.string()),
  whyRelevant: v.optional(v.string()),
  overlapNotes: v.optional(v.string()),
  // Bias review (bias-granskning), filled in E2.
  biasRisk: v.optional(
    v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
  ),
  biasComment: v.optional(v.string()),
  biasAction: v.optional(v.string()),
  approved: v.optional(v.boolean()),
  decidedBy: v.optional(v.string()),
  decidedAt: v.optional(v.number()),
})
  .index("by_model", ["modelId"])
  .index("by_org", ["orgId"])

export const criterionAnchors = defineTable({
  criterionId: v.id("criteria"),
  level: v.number(), // 0-5
  text: v.string(),
}).index("by_criterion", ["criterionId"])

export const tracks = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  key: v.string(), // IC | Lead | M
  name: v.string(),
  order: v.number(),
}).index("by_model", ["modelId"])

export const levels = defineTable({
  trackId: v.id("tracks"),
  key: v.string(), // IC1..IC5, Lead1..Lead3, M1..M3
  name: v.string(),
  definition: v.optional(v.string()),
  order: v.number(),
}).index("by_track", ["trackId"])

export const trackGuardrails = defineTable({
  orgId: v.string(),
  levelId: v.id("levels"),
  criterionId: v.id("criteria"),
  min: v.number(),
  max: v.number(),
}).index("by_level", ["levelId"])

export const bandThresholds = defineTable({
  orgId: v.string(),
  modelId: v.id("models"),
  band: v.number(), // 1-7, Band 1 = highest
  minScore: v.number(),
}).index("by_model", ["modelId"])
```

- [ ] **Step 2: assessment tables** (`convex/assessment/tables.ts`)

```ts
import { defineTable } from "convex/server"
import { v } from "convex/values"

// Role identity is permanent: never hard-delete a role with ratings or
// approved status, never reuse ids (V2 equal-work grouping depends on it).
// Role/rating tables NEVER carry person, salary, or performance fields.
export const roles = defineTable({
  orgId: v.string(),
  name: v.string(),
  function: v.string(),
  team: v.string(),
  trackId: v.id("tracks"),
  levelId: v.id("levels"),
  purpose: v.string(),
  responsibilities: v.string(),
  decisionMandate: v.optional(v.string()),
  stakeholders: v.optional(v.string()),
  knowledge: v.optional(v.string()),
  financial: v.optional(v.string()),
  people: v.optional(v.string()),
  risk: v.optional(v.string()),
  deliverables: v.optional(v.string()),
  status: v.union(
    v.literal("draft"),
    v.literal("inReview"),
    v.literal("approved")
  ),
  archivedAt: v.optional(v.number()),
})
  .index("by_org", ["orgId"])
  .index("by_org_status", ["orgId", "status"])

// The stored truth (ADR-0002): ratings persist, score/band derive.
export const ratings = defineTable({
  orgId: v.string(),
  roleId: v.id("roles"),
  criterionId: v.id("criteria"),
  value: v.number(), // 0-5; uniqueness per (role, criterion) enforced in mutations
  motivation: v.optional(v.string()),
})
  .index("by_role_criterion", ["roleId", "criterionId"])
  .index("by_org", ["orgId"])
```

- [ ] **Step 3: suggestions table** (append to `convex/shared/tables.ts`)

```ts
// AI suggestion layer (ADR-0003): suggestions with provenance, separate from
// confirmed values. Schema only in this slice; no AI calls yet.
export const suggestions = defineTable({
  orgId: v.string(),
  target: v.object({
    kind: v.string(), // e.g. "role.field" | "criterion.anchor"
    roleId: v.optional(v.id("roles")),
    criterionId: v.optional(v.id("criteria")),
    field: v.optional(v.string()),
  }),
  suggestedValue: v.any(),
  motivation: v.optional(v.string()),
  source: v.literal("ai"),
  status: v.union(
    v.literal("suggested"),
    v.literal("confirmed"),
    v.literal("rejected")
  ),
  model: v.optional(v.object({ provider: v.string(), model: v.string() })),
  confirmedBy: v.optional(v.string()),
})
  .index("by_org", ["orgId"])
  .index("by_org_status", ["orgId", "status"])
```

Compose everything in `convex/schema.ts` (final shape):

```ts
import { defineSchema } from "convex/server"
import { users, workspaceProfiles } from "./accounts/tables"
import { ratings, roles } from "./assessment/tables"
import { emails } from "./email/tables"
import {
  bandThresholds,
  criteria,
  criterionAnchors,
  levels,
  models,
  trackGuardrails,
  tracks,
} from "./evaluationModel/tables"
import { auditLog, suggestions } from "./shared/tables"

export default defineSchema({
  users,
  workspaceProfiles,
  models,
  criteria,
  criterionAnchors,
  tracks,
  levels,
  trackGuardrails,
  bandThresholds,
  roles,
  ratings,
  auditLog,
  suggestions,
  emails,
})
```

- [ ] **Step 4: Schema smoke test** (`convex/schema.test.ts`)

```ts
import { describe, expect, it } from "vitest"
import { initConvexTest } from "./testing.helpers"

// Inserts one minimal valid row per domain table so validator regressions
// fail loudly. Score/band fields must not exist anywhere (ADR-0002).
describe("domain schema skeleton", () => {
  it("accepts a minimal valid row in every domain table", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId: "org1",
        name: "Standard",
      })
      const criterionId = await ctx.db.insert("criteria", {
        orgId: "org1",
        modelId,
        name: "Scope & Impact",
        description: "d",
        helpText: "h",
        importanceLevel: 7,
        order: 1,
        isCustom: false,
      })
      await ctx.db.insert("criterionAnchors", {
        criterionId,
        level: 0,
        text: "anchor",
      })
      const trackId = await ctx.db.insert("tracks", {
        orgId: "org1",
        modelId,
        key: "IC",
        name: "Individual Contributor",
        order: 1,
      })
      const levelId = await ctx.db.insert("levels", {
        trackId,
        key: "IC1",
        name: "IC1",
        order: 1,
      })
      await ctx.db.insert("trackGuardrails", {
        orgId: "org1",
        levelId,
        criterionId,
        min: 0,
        max: 2,
      })
      await ctx.db.insert("bandThresholds", {
        orgId: "org1",
        modelId,
        band: 1,
        minScore: 530,
      })
      const roleId = await ctx.db.insert("roles", {
        orgId: "org1",
        name: "Software Developer",
        function: "Engineering",
        team: "Platform",
        trackId,
        levelId,
        purpose: "p",
        responsibilities: "r",
        status: "draft",
      })
      await ctx.db.insert("ratings", {
        orgId: "org1",
        roleId,
        criterionId,
        value: 3,
      })
      await ctx.db.insert("suggestions", {
        orgId: "org1",
        target: { kind: "role.field", roleId, field: "purpose" },
        suggestedValue: "Suggested purpose",
        source: "ai",
        status: "suggested",
      })
      expect(await ctx.db.query("roles").collect()).toHaveLength(1)
    })
  })
})
```

- [ ] **Step 5: Run red, implement, run green, push, commit**

Run: `cd packages/backend && bun run test && bunx convex dev --once`

```bash
git add packages/backend
git commit -m "feat(backend): add V1 domain schema skeleton (evaluation model, assessment, suggestions)"
```

---

## Task 14: apps/dashboard scaffold (auth shell)

The shell is deliberately unstyled (plain HTML); the design system integration comes with the product UI slice (PLAN-V1 open question 9). Dashboard runs on port 3001; `apps/web` owns 3000.

**Files:**
- Create: `apps/dashboard/package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts` (generated)
- Create: `apps/dashboard/proxy.ts`
- Create: `apps/dashboard/i18n/request.ts`
- Create: `apps/dashboard/app/layout.tsx`
- Create: `apps/dashboard/app/page.tsx`
- Create: `apps/dashboard/lib/auth-client.ts`, `apps/dashboard/lib/auth-server.ts`
- Create: `apps/dashboard/app/api/auth/[...all]/route.ts`
- Create: `apps/dashboard/components/providers.tsx`
- Create: `apps/dashboard/.env.local` (not committed)

- [ ] **Step 1: Package manifest** (`apps/dashboard/package.json`)

```json
{
  "name": "dashboard",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@convex-dev/better-auth": "0.12.2",
    "@workspace/backend": "workspace:*",
    "@workspace/i18n": "workspace:*",
    "better-auth": "1.6.14",
    "convex": "^1.35.0",
    "next": "16.2.6",
    "next-intl": "^4.13.0",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "@testing-library/react": "^16.3.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^5.0.0",
    "@workspace/typescript-config": "workspace:*",
    "@workspace/vitest-config": "workspace:*",
    "typescript": "^5",
    "vitest": "^4.1.0"
  }
}
```

`apps/dashboard/tsconfig.json`:

```json
{
  "extends": "@workspace/typescript-config/nextjs.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@workspace/i18n/*": ["../../packages/i18n/src/*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "next.config.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Next config and proxy**

`apps/dashboard/next.config.ts`:

```ts
import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./i18n/request.ts")

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/backend", "@workspace/i18n"],
}

export default withNextIntl(nextConfig)
```

`apps/dashboard/proxy.ts` (explicit function per CLAUDE.md; no i18n routing because the dashboard has no locale in the URL; reserved for auth gating later):

```ts
import { type NextRequest, NextResponse } from "next/server"

export default function proxy(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
}
```

`apps/dashboard/i18n/request.ts` (locale is a user setting later; the shell is English):

```ts
import { getRequestConfig } from "next-intl/server"

export default getRequestConfig(async () => {
  const locale = "en"
  return {
    locale,
    messages: (await import(`@workspace/i18n/messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 3: Auth client/server wiring**

`apps/dashboard/lib/auth-server.ts`:

```ts
import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs"

export const { handler, preloadAuthQuery, isAuthenticated, getToken } =
  convexBetterAuthNextJs({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL ?? "",
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "",
  })
```

`apps/dashboard/app/api/auth/[...all]/route.ts`:

```ts
import { handler } from "@/lib/auth-server"

export const { GET, POST } = handler
```

`apps/dashboard/lib/auth-client.ts`:

```ts
import { ac, admin, editor } from "@workspace/backend/convex/betterAuth/permissions"
import { convexClient } from "@convex-dev/better-auth/client/plugins"
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles: { admin, editor } }), convexClient()],
})
```

`apps/dashboard/components/providers.tsx`:

```tsx
"use client"

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import { ConvexReactClient } from "convex/react"
import type { ReactNode } from "react"
import { authClient } from "@/lib/auth-client"

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL ?? ""
)

export function Providers(props: {
  children: ReactNode
  initialToken: string | null
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      authClient={authClient}
      initialToken={props.initialToken}
    >
      {props.children}
    </ConvexBetterAuthProvider>
  )
}
```

- [ ] **Step 4: Layout and home page**

`apps/dashboard/app/layout.tsx`:

```tsx
import { NextIntlClientProvider } from "next-intl"
import { getLocale } from "next-intl/server"
import type { ReactNode } from "react"
import { Providers } from "@/components/providers"
import { getToken } from "@/lib/auth-server"

export default async function RootLayout(props: { children: ReactNode }) {
  const locale = await getLocale()
  const token = await getToken()
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers initialToken={token ?? null}>{props.children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

`apps/dashboard/app/page.tsx` (signed-in landing, exercises the reactive client):

```tsx
"use client"

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"

export default function HomePage() {
  const t = useTranslations("dashboard")
  return (
    <main>
      <h1>{t("title")}</h1>
      <AuthLoading>
        <p>{t("auth.loading")}</p>
      </AuthLoading>
      <Unauthenticated>
        <Link href="/sign-in">{t("auth.signIn.cta")}</Link>
      </Unauthenticated>
      <Authenticated>
        <p>{t("auth.signedIn")}</p>
      </Authenticated>
    </main>
  )
}
```

- [ ] **Step 5: Env, install, boot**

`apps/dashboard/.env.local` (values from `packages/backend/.env.local` and the Convex dashboard; `.convex.site` URL for the site URL):

```
NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<deployment>.convex.site
NEXT_PUBLIC_SITE_URL=http://localhost:3001
```

Run: `bun install`, then in one terminal `cd packages/backend && bun run dev`, in another `cd apps/dashboard && bun run dev`.
Expected: http://localhost:3001 renders the unauthenticated state without console errors. (i18n keys come in Task 15; add them before booting or accept missing-message warnings until then.)

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard bun.lock
git commit -m "feat(dashboard): scaffold app shell with Convex and Better Auth wiring"
```

---

## Task 15: Sign-in/up + accept-invitation pages + i18n + smoke test

**Files:**
- Modify: `packages/i18n/messages/en.json` (+ sv, nb, da, fi): `dashboard.*` keys
- Create: `apps/dashboard/components/auth/email-password-form.tsx`
- Create: `apps/dashboard/app/sign-in/page.tsx`
- Create: `apps/dashboard/app/sign-up/page.tsx`
- Create: `apps/dashboard/app/accept-invitation/[id]/page.tsx`
- Create: `apps/dashboard/vitest.config.ts`
- Test: `apps/dashboard/components/auth/email-password-form.test.tsx`

- [ ] **Step 1: Add the dashboard.* keys to en.json (then mirror to all locales)**

```json
"dashboard": {
  "title": "blueprnt",
  "auth": {
    "loading": "Checking your session",
    "signedIn": "You are signed in.",
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "signIn": { "title": "Sign in", "cta": "Sign in" },
    "signUp": { "title": "Create account", "cta": "Create account" },
    "invitation": {
      "title": "Workspace invitation",
      "accept": "Accept invitation",
      "accepted": "Invitation accepted.",
      "signInFirst": "Sign in to accept this invitation."
    },
    "error": "Something went wrong. Please try again."
  }
}
```

The parity test enforces the mirroring; commit message flags nb/da/fi as machine drafts.

- [ ] **Step 2: Shared form component** (`components/auth/email-password-form.tsx`)

```tsx
"use client"

import { useTranslations } from "next-intl"
import { type FormEvent, useState } from "react"

export interface EmailPasswordValues {
  email: string
  password: string
  name?: string
}

export function EmailPasswordForm(props: {
  mode: "signIn" | "signUp"
  onSubmit: (values: EmailPasswordValues) => Promise<void>
}) {
  const t = useTranslations("dashboard.auth")
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    setError(false)
    try {
      await props.onSubmit({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
        name: data.get("name") === null ? undefined : String(data.get("name")),
      })
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>{t(`${props.mode}.title`)}</h1>
      {props.mode === "signUp" ? (
        <label>
          {t("name")}
          <input name="name" type="text" required />
        </label>
      ) : null}
      <label>
        {t("email")}
        <input name="email" type="email" required />
      </label>
      <label>
        {t("password")}
        <input name="password" type="password" required minLength={8} />
      </label>
      {error ? <p role="alert">{t("error")}</p> : null}
      <button type="submit" disabled={pending}>
        {t(`${props.mode}.cta`)}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Pages**

`app/sign-in/page.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { authClient } from "@/lib/auth-client"

export default function SignInPage() {
  const router = useRouter()
  return (
    <main>
      <EmailPasswordForm
        mode="signIn"
        onSubmit={async ({ email, password }) => {
          const { error } = await authClient.signIn.email({ email, password })
          if (error) throw error
          router.push("/")
        }}
      />
    </main>
  )
}
```

`app/sign-up/page.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { authClient } from "@/lib/auth-client"

export default function SignUpPage() {
  const router = useRouter()
  return (
    <main>
      <EmailPasswordForm
        mode="signUp"
        onSubmit={async ({ email, password, name }) => {
          const { error } = await authClient.signUp.email({
            email,
            password,
            name: name ?? "",
          })
          if (error) throw error
          router.push("/")
        }}
      />
    </main>
  )
}
```

`app/accept-invitation/[id]/page.tsx`:

```tsx
"use client"

import { Authenticated, Unauthenticated } from "convex/react"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"

export default function AcceptInvitationPage() {
  const t = useTranslations("dashboard.auth.invitation")
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [error, setError] = useState(false)

  return (
    <main>
      <h1>{t("title")}</h1>
      <Unauthenticated>
        <p>{t("signInFirst")}</p>
        <Link href="/sign-in">{t("signInFirst")}</Link>
      </Unauthenticated>
      <Authenticated>
        {error ? <p role="alert">{t("title")}</p> : null}
        <button
          type="button"
          onClick={async () => {
            const { error: acceptError } =
              await authClient.organization.acceptInvitation({
                invitationId: params.id,
              })
            if (acceptError) {
              setError(true)
              return
            }
            router.push("/")
          }}
        >
          {t("accept")}
        </button>
      </Authenticated>
    </main>
  )
}
```

- [ ] **Step 4: Vitest config + smoke test**

`apps/dashboard/vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react"
import { defineProject, mergeConfig } from "vitest/config"
import { reactConfig } from "@workspace/vitest-config/react"

export default mergeConfig(
  reactConfig,
  defineProject({
    plugins: [react()],
    resolve: {
      alias: { "@": new URL("./", import.meta.url).pathname },
    },
  })
)
```

`components/auth/email-password-form.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { describe, expect, it } from "vitest"
import en from "@workspace/i18n/messages/en.json"
import { EmailPasswordForm } from "./email-password-form"

function renderForm(mode: "signIn" | "signUp") {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EmailPasswordForm mode={mode} onSubmit={async () => {}} />
    </NextIntlClientProvider>
  )
}

describe("EmailPasswordForm", () => {
  it("renders email and password fields for sign-in", () => {
    renderForm("signIn")
    expect(screen.getByLabelText("Email")).toBeDefined()
    expect(screen.getByLabelText("Password")).toBeDefined()
    expect(screen.queryByLabelText("Name")).toBeNull()
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDefined()
  })

  it("adds the name field for sign-up", () => {
    renderForm("signUp")
    expect(screen.getByLabelText("Name")).toBeDefined()
  })
})
```

If next-intl needs inlining under Vitest, add `test: { server: { deps: { inline: ["next-intl"] } } }` per https://next-intl.dev/docs/environments/testing.

- [ ] **Step 5: Run tests red → green, full suite, commit**

Run: `cd apps/dashboard && bun run test` (red before components exist, green after), then root `bun run test && bun run typecheck`.

```bash
git add apps/dashboard packages/i18n
git commit -m "feat(dashboard): add sign-in, sign-up and accept-invitation pages

nb/da/fi strings are machine-translated drafts pending native review."
```

---

## Task 16: Coverage thresholds + end-to-end verification + wrap-up

**Files:**
- Modify: `packages/vitest-config/src/base.ts` (coverage thresholds)
- Modify: `packages/core/vitest.config.ts`, `packages/email/vitest.config.ts` (raise to 95)

- [ ] **Step 1: Default coverage thresholds in the base preset**

In `packages/vitest-config/src/base.ts`, extend `coverage` with:

```ts
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
```

In `packages/core/vitest.config.ts` and `packages/email/vitest.config.ts`, override inside `defineProject({ test: { coverage: { thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 } } } })`. Thresholds only apply to `test:coverage` runs (CI gate later); the plain `test` script stays fast.

- [ ] **Step 2: Full verification battery**

```bash
bun run test            # all packages green (then re-run: FULL TURBO)
bun run typecheck       # all packages
cd packages/backend && bunx convex codegen --typecheck enable && cd ../..
bash .githooks/pre-commit
```

Expected: everything green; codegen confirms committed `_generated/` matches the schema.

- [ ] **Step 3: Manual browser verification (REQUIRES USER for email checks)**

With `packages/backend` dev and `apps/dashboard` dev running:
1. Sign up at http://localhost:3001/sign-up; expect a verification email row in the `emails` table (status `sent` once Scaleway creds exist; `failed` otherwise, which is acceptable pre-creds) and delivery to the inbox when creds are set.
2. Sign in at /sign-in; the home page shows the signed-in state.
3. Workspace creation and member invitation have no UI in this slice; they are covered by the backend test suite. Full flow verification (create workspace, invite, accept at /accept-invitation/:id) happens in the next slice when the workspace UI lands; the invitation email path can be exercised early via the Convex dashboard function runner if desired.

- [ ] **Step 4: Final commit + spec status**

Update the spec header (`docs/superpowers/specs/2026-06-04-convex-backend-better-auth-design.md`): `Status: implemented (Fas 1 foundation)`.

```bash
git add packages/vitest-config packages/core packages/email docs/superpowers/specs
git commit -m "chore: add coverage thresholds and mark foundation spec implemented"
```

---

## Spec coverage map

| Spec section | Tasks |
| --- | --- |
| 3 Packages and deployment | 1, 4, 5, 14 |
| 4 Auth design | 6, 7, 8, 9 |
| 5 Email architecture | 11, 12 |
| 6 Data model | 8, 10, 12, 13 |
| 7 Conventions, errors, audit | 9, 10 |
| 8 Testing strategy | 1, 2, 3, 16 (+ TDD throughout) |
| 9 Build order | task order mirrors it (testing foundation first) |
| 11 Risks | 6 (#157 index), 7/9 (#235 avoidance), 12 (Scaleway, graceful failure) |



