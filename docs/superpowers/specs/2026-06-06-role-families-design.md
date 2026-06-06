# Role Families Design: Grouping Roles + Documentation Guide

Design spec for the role-families slice. Read together with the implementation
plan `docs/superpowers/plans/2026-06-06-role-families.md`.

## Goal

Roles can be grouped into rollfamiljer (role families, the glossary term:
"Software Engineering" or drawn as broadly as the organization wants, e.g.
"Teknik"). The family becomes a real entity: pickable when creating/editing a
role, a grouping on the roles list, a filter on the results view, and a
per-family progression page. This deliberately changes PLAN-V1 9.14
("modelleras inte som egen entitet i V1"), and the change is documented in the
glossary and the plan. The slice also ships docs/README.md: the guide for
WHERE decisions and solutions are documented.

## Decisions (founder, 2026-06-06)

1. **Rollfamilj as its own entity** (glossary term; never "jobbfamilj").
   The free-text `function` (Funktion/avdelning) field stays unchanged as
   organizational placement; the family is content grouping. Granularity is
   per organization (glossary note from 2026-06): a family MAY be drawn as
   broadly as a whole department's discipline.
2. **All four UI surfaces**: roles list grouping, family picker on
   create/edit, results filter, and the per-family progression view that
   9.14 deferred.
3. **Documentation, both parts**: this decision lands in the glossary +
   PLAN 9.14, AND a new docs/README.md describes where solutions and
   decisions are documented (ADR vs glossary vs PLAN vs specs/plans).
4. **Built as its own slice** on feat/role-families after the evaluation
   loop was squash-merged to main.

## Settled design (from the docs and conventions)

- **familyId is OPTIONAL on roles.** Existing roles have none; a role without
  a family renders under "No family" at the end of groupings. No migration.
- **Families never touch scoring.** The engine (packages/core) is untouched;
  families are presentation/organization only. No band.shift wraps needed:
  no family mutation can change a derived band.
- **Member scope** (orgMutation): families are role content, like roles
  themselves. Editors and admins create, rename, and remove families.
- **Removal clears membership.** Removing a family patches `familyId`
  away from its roles (audited) and deletes the family row. Families carry
  no derived data, so hard delete is safe (unlike roles, whose ids are
  permanent).
- **Name uniqueness per org**, case-insensitive on the trimmed name
  (errors.roleFamilyExists). Renames revalidate.
- **Routes**: the family page lives at `/roles/families/[familyId]`
  (static segment wins over `/roles/[roleId]`, so no conflict; a bare
  `/roles/families` falls through to the roleId route and renders the
  existing not-found state, which is acceptable).
- **Roles page**: grouped under family headings (families sorted by name,
  "No family" last). Grouping replaces a separate filter control there.
- **Results page**: a family filter Select (default all). The band overview
  and the table both reflect the filtered rows. Grouping is not used here:
  it would fight the band-first sorting.
- **Family page (progression)**: family name + rename/remove actions, roles
  grouped per track (track order), ordered by level order, each row links to
  the role and shows level key, status badge, and rating progress or the
  band outcome badge when complete (same visibility rule as the results
  view; blindness is unaffected: values appear only for complete roles).
- **No new ADR.** This is a data-model evolution, not an architecture
  invariant; the glossary + PLAN updates are the record. docs/README.md
  explains exactly this routing of decisions.

## Schema (packages/backend)

```
roleFamilies: { orgId: string, name: string }
  .index("by_org", ["orgId"])

roles: + familyId: v.optional(v.id("roleFamilies"))
```

## Backend surface

| Function | Kind | Notes |
| --- | --- | --- |
| `assessment/families.createRoleFamily` | orgMutation | trimmed non-empty name, max 100 chars; case-insensitive unique per org (errors.roleFamilyExists); audit roleFamily.created |
| `assessment/families.renameRoleFamily` | orgMutation | same validation; no-op short-circuit on unchanged name; audit roleFamily.renamed |
| `assessment/families.removeRoleFamily` | orgMutation | clears familyId from the org's roles that reference it (audited per role via role.updated? NO: one roleFamily.removed audit row carries the affected roleIds), deletes the row |
| `assessment/families.listRoleFamilies` | orgQuery | { familyId, name, roleCount } sorted by name (locale-aware) |
| `assessment/roles.createRole` / `updateRole` | extended | optional familyId; must belong to the org (errors.notFound); updateRole accepts clearing via familyId: null sentinel (see plan) |
| `assessment/roles.listRoles` | extended | rows gain familyId (string or null), familyName (string or null), trackOrder, levelOrder (for the family page's sorting) |
| `assessment/roles.getRole` | extended | gains familyId/familyName |
| `assessment/results.getResults` | extended | rows gain familyId/familyName (for the filter) |

Audit events: `roleFamily.created`, `roleFamily.renamed`, `roleFamily.removed`
(payload includes clearedRoleIds). Error code: `errors.roleFamilyExists`.

Convex note: optional args cannot distinguish "leave unchanged" from "clear".
updateRole therefore takes `familyId: v.optional(v.union(v.id("roleFamilies"), v.null()))`:
undefined = unchanged, null = clear, id = set.

## UI

- **Family picker** (create dialog + profile card edit mode): a Select of
  the org's families with a "none" item and a "create new" item that swaps
  in an inline Input + confirm (no separate management page; families are
  born where they are needed; simplicity-first).
- **Roles page**: section heading per family (name + count), table per
  section, "No family" section last; empty families do not render sections.
- **Results page**: Select filter above the band overview; "all families"
  default; filtering recomputes the distribution client-side from the
  filtered rows (bandCounts is already pure).
- **Family page**: heading with inline rename (member scope) and a
  MorphConfirmButton removal (label variant; removal navigates back to
  /roles); per-track sections ordered by track order; role rows ordered by
  level order showing levelKey, title (link), status badge, progress or
  band badge.
- Weights never appear; scores/bands only where the results rules already
  allow them.

## Documentation deliverables (in this slice)

1. **docs/README.md** (Swedish): where things are documented and why:
   domain terms -> `docs/contexts/*/CONTEXT.md` (glossaries), architecture
   invariants -> `docs/adr/`, scope/plan/open questions -> `docs/PLAN-V1.md`
   (oppna fragor flyttas till Avgjort med datum nar de avgors), slice specs
   and plans -> `docs/superpowers/`, UI/animation lessons ->
   `docs/ui-animation.md`, agent/developer rules -> `CLAUDE.md`/`AGENTS.md`.
   Includes the rule: every decided question is written down the same day it
   is decided, in the most specific home it has.
2. **Glossary** (`docs/contexts/evaluation-model/CONTEXT.md`): Rollfamilj
   entry updated: modeled as an entity (decision 2026-06-06), hierarchy
   rollfamilj -> roll/nivaroll -> (V2) medarbetare, optional membership,
   granularity per organization, families never affect scoring.
3. **PLAN-V1 9.14**: updated from "modelleras inte som egen entitet i V1"
   to the new decision, with date and pointer to this spec.
4. **Assessment glossary** (`docs/contexts/assessment/CONTEXT.md`): the Roll
   entry's family reference stays correct (it already points to the
   evaluation-model glossary).

## i18n

`model.roleFamily` exists ("Rollfamilj"/"Role family"). New keys under
`dashboard.roles.family.*` (picker labels, none/all items, create/rename/
remove flows, family page strings) plus `errors.roleFamilyExists`. en first,
sv mirrored, nb/da/fi machine drafts flagged for native review.

## Out of scope

- Family-level analytics or band statistics beyond the filtered overview
- Reordering/merging families; drag and drop
- Track/level progression EDITING from the family page (view only)
- V2 lika/likvardigt arbete grouping (may build on families later)
- Family descriptions or metadata beyond the name

## Acceptance criteria

1. All suites green (engine untouched: packages/core diff is empty).
2. A role can be created with a family, moved between families, and
   cleared; every change audited (role.updated fields include familyId).
3. Duplicate family names (case-insensitive, trimmed) are rejected with
   errors.roleFamilyExists; the UI shows the translated message.
4. Removing a family clears membership on its roles (visible immediately
   in the grouped roles list) and logs roleFamily.removed with the cleared
   roleIds; role rows themselves are never deleted.
5. Roles page groups by family with "No family" last; results page filter
   narrows both the table and the band overview; the family page shows
   per-track progression ordered by level.
6. i18n parity passes; no hardcoded display text; no em dashes.
7. docs/README.md exists (Swedish), the glossary and PLAN 9.14 reflect the
   entity decision with the 2026-06-06 date.
8. Families never appear in packages/core and no scoring behavior changes
   (the 540/Band 1 anchors still pass untouched).
