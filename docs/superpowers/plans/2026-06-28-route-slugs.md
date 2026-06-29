# Route slugs implementation plan

> Replace long Convex ids in routes with human-readable, per-org-unique slugs.

**Goal:** `/roles/system-developer` and `/roles/families/engineering` instead of `/roles/jh7d59...`. A slug is generated at creation, regenerated on rename, unique within the org, and falls back to a short id when a name has no slug-able characters.

**Decisions (confirmed):** slug is a **required** field; **reset dev data** (no backfill); **slug-only** route resolution (an old id URL 404s). Convex `_id` stays the permanent internal key (ADR-0005/0006) and is still what every mutation takes; only route params and link hrefs switch to slug.

**Scope:** route-exposed entities = `roles` (slug from `title`) and `roleFamilies` (slug from `name`).

---

## Global constraints

- New strings via i18n in all 5 locales; no em dashes; English code/comments.
- New code ships with tests; pre-commit (Biome + typecheck + full `turbo run test`) must pass.
- Reuse the existing `slugify` from `@workspace/constants` (`packages/constants/src/slug.ts`, Nordic-aware, returns `""` for empty).
- No new dependency: short ids via `crypto.randomUUID()` (already used in `assessment/starters.ts`).

---

## Task 1: Slug helper (backend)

**Create** `packages/backend/convex/lib/slug.ts`:
- `shortId(): string` -> `crypto.randomUUID().replace(/-/g, "").slice(0, 8)`.
- `uniqueSlug(ctx, table: "roles" | "roleFamilies", source: string, excludeId?): Promise<string>`:
  - `base = slugify(source) || shortId()` (empty title -> short id).
  - taken-check via the new `by_org_slug` index (`q.eq("orgId", ctx.orgId).eq("slug", candidate)`), ignoring `excludeId` (so a rename does not collide with itself).
  - if `base` free -> return it; else loop `${base}-${shortId()}` until free.

**Test** `lib/slug.test.ts` (convex-test): unique base, collision appends suffix, empty title yields a short id, rename keeps own slug.

## Task 2: Schema

**Modify** `packages/backend/convex/assessment/tables.ts`:
- `roles`: add `slug: v.string()`, add `.index("by_org_slug", ["orgId", "slug"])`.
- `roleFamilies`: add `slug: v.string()`, add `.index("by_org_slug", ["orgId", "slug"])`.

## Task 3: Mutations set/regenerate slug

**Modify** `packages/backend/convex/assessment/roles.ts`:
- `createRole`: `slug: await uniqueSlug(ctx, "roles", title)` in the insert.
- `updateRole`: when `patch.title` is set and differs from `role.title`, `patch.slug = await uniqueSlug(ctx, "roles", title, args.roleId)`.

**Modify** `packages/backend/convex/assessment/families.ts`:
- `createRoleFamily`: add `slug: await uniqueSlug(ctx, "roleFamilies", name)`.
- `renameRoleFamily`: it already early-returns on unchanged name, so on the write path add `slug: await uniqueSlug(ctx, "roleFamilies", name, args.familyId)` to the patch.

Also check `assessment/seed.ts` / `devCompany.ts` / `model.ts` (`createModelFromTemplate`) and `industryStarters.ts` for any direct `insert("roles" | "roleFamilies")` and give each a slug.

## Task 4: Queries expose slug + by-slug resolvers

**Modify** `packages/backend/convex/assessment/roles.ts`:
- `listRoles`: add `slug: v.string()` to the returns object and `slug: role.slug` to the map.
- `getRole`: add `slug` to its returns (so link sites that load a single role get it).
- Add `getRoleBySlug` (orgQuery, args `{ slug }`): resolve via `by_org_slug`; return the same shape as `getRole` (or `null`).

**Modify** `packages/backend/convex/assessment/families.ts`:
- `listRoleFamilies`: add `slug` to returns + map.

**Modify** `packages/backend/convex/assessment/results.ts`:
- `getResults` rows: add `slug` (role-chip / pending-roles / roles-table link off results rows).

## Task 5: Routes resolve by slug

- Rename folder `app/(app)/roles/[roleId]` -> `[roleSlug]` (carry the `rate/` subroute).
- Rename folder `app/(app)/roles/families/[familyId]` -> `[familySlug]`.
- `[roleSlug]/page.tsx` + `[roleSlug]/rate/page.tsx`: read `roleSlug`, load via `getRoleBySlug`; use the returned `role.roleId` for mutations (archive, rate, etc.) unchanged.
- `[familySlug]/page.tsx`: read `familySlug`, find the family in `listRoleFamilies` by `slug`, then filter roles by its `familyId` as today.

## Task 6: Links use slug

Change every href/`router.push` from id to slug. Each link site already has (or will have, via Tasks 4) the slug on its row/role object:
- `components/roles/roles-table.tsx` (role link + family link + row push)
- `components/role-sheet.tsx` ("open role" link)
- `components/bands/role-chip.tsx`, `components/bands/pending-roles.tsx`
- `components/roles/role-rating-card.tsx` (`/roles/${slug}/rate`)
- `app/(app)/roles/[roleSlug]/rate/page.tsx` (back-to-role links)
- `app/(app)/roles/families/[familySlug]/page.tsx` (role links)
- `components/roles/create-role-dialog.tsx`: navigate to the new role. `createRole` returns the slug too (return `{ roleId, slug }` or a second query); push `/roles/${slug}`.

## Task 7: Tests

Update for the new param/links/returns: `role-sheet.test.tsx` (expects `/roles/role_1` -> a slug), `roles-table` tests, `bands` tests, `roles.test.ts` / `families.test.ts` (insert + assert slug, rename regenerates, collision), any route tests, and the new `lib/slug.test.ts`.

## Task 8: Migration (reset dev data) + push order

Required field cannot be pushed while existing rows lack it, so:
1. Land Tasks 1-7 in the working tree.
2. Clear dev `ratings`, `roles`, `roleFamilies` (a one-off internal mutation run via `convex run`, then discarded; or the Convex dashboard).
3. `convex dev` pushes the required-slug schema against the now-empty tables.
4. Re-seed the dev company (seeder / recreate roles); new rows carry slugs.

## Task 9: CLAUDE.md convention

Add under "Conventions":
> **Route-exposed entities use a slug, never a raw id, in the URL.** Every entity reachable by its own route carries a required `slug` (lowercase, hyphenated, ASCII-folded via `@workspace/constants` `slugify`), generated from its display name at creation and regenerated on rename, unique per org with a `by_org_slug` index; when the name has no slug-able characters, fall back to a short id (`crypto.randomUUID()` slice). Routes resolve by `(orgId, slug)`; the Convex `_id` stays the permanent internal key that mutations take.

---

## File list

Backend: `lib/slug.ts` (+test), `assessment/tables.ts`, `assessment/roles.ts` (+test), `assessment/families.ts` (+test), `assessment/results.ts`, plus any seeder inserts.
Frontend: the two route folders (renamed) + their pages, `roles-table.tsx`, `role-sheet.tsx`, `bands/role-chip.tsx`, `bands/pending-roles.tsx`, `roles/role-rating-card.tsx`, `roles/create-role-dialog.tsx`, and the affected tests.
Docs: `CLAUDE.md`.
