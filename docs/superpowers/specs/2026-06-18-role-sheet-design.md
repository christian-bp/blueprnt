# RoleSheet: a reusable role quick-look panel

**Goal:** Clicking a role in the Overview opens a right-side Sheet with a read-only summary of that role, instead of navigating to the role page. The sheet is a self-contained, app-wide-reusable primitive that any surface can open.

**Status:** Approved design. Ready for an implementation plan.

## Background

In the Overview (`apps/dashboard/app/(app)/work/page.tsx`), roles render as `RoleChip` (`apps/dashboard/components/bands/role-chip.tsx`) inside `BandLadder`, `BandMatrix`, and `PendingRoles`. Today each chip is a `next/link` `<Link href={/roles/${roleId}}>`, so clicking leaves the Overview for the full role detail page.

The full role page (`apps/dashboard/app/(app)/roles/[roleId]/page.tsx`) is an editing surface: it composes `RoleProfileCard` (edit form plus AI draft panel), `RoleRatingCard` (rating progress plus the blind-stepper entry point), `RoleStatusActions` (status workflow), `RoleResultCard` (weighting, band, per-criterion contribution), and `AnchorRoleCard` (anchor designation). Most of that is mutation-bound and belongs on the page. The genuinely informational pieces are the result summary, the per-criterion contribution breakdown, and the profile prose.

For a quick look from the Overview, a side sheet that shows that information (and links out to the page for any edit) is faster than a full navigation and keeps the user's place in the grid.

## Decisions (locked with the user)

- The sheet is a **read-only quick-look**: header signals, result summary (weighting and band, or progress when incomplete), the per-criterion contribution breakdown, and profile prose. No editing, AI, status workflow, or anchor designation in the sheet. A primary **Open role** action links to the full page for anything beyond reading.
- It opens via a **context provider** (`RoleSheetProvider` plus a `useRoleSheet()` hook), so any role chip (or future surface) can open it with no prop drilling. The `RoleSheet` itself is self-contained: given a `roleId`, it fetches and renders.
- The provider is mounted **once in the app shell**, so "open a role" works anywhere. When closed it renders nothing visible and runs no queries.

## Detailed design

### Components and files

- **`apps/dashboard/components/role-sheet.tsx`** (new, at the `components/` root, the home for reusable app primitives like the morph family). Exports:
  - `RoleSheetProvider` (`children`): holds the open `roleId` in state, provides the context value, and renders the single `<Sheet>` instance as a sibling of `children`.
  - `useRoleSheet()`: returns `{ openRole(roleId: string): void }`. The context is also consumed directly by `RoleChip` (see Wiring) to decide link-vs-button.
  - An internal `RoleSheetContent` that, given the open `roleId`, runs the queries and renders the body. Kept as a separate component so the queries only mount when there is a role to show.
- **`apps/dashboard/components/roles/role-criterion-breakdown.tsx`** (new): the per-criterion contribution list (the share computation, sort, and animated bars currently inline in `role-result-card.tsx` lines 51-139) extracted into one presentational component. Props: `criteria: { criterionId; name; value; weightPoints; motivation }[]` (the `getRoleResult.criteria` shape). It computes `criterionShares()` from `@workspace/core`, sorts by share descending with the canonical order as tiebreak, normalizes bar fill to the top driver, and renders the animated rows. Both `RoleResultCard` and the sheet render it, so the animation-sensitive logic (see `docs/ui-animation.md`) lives in exactly one place.
- **`apps/dashboard/components/roles/role-result-card.tsx`** (edit): keep the `getRoleResult` query, the Card chrome, the score/band header, the "Band 1 is the highest" line, and the breakdown label plus help. Replace the inline rows block with `<RoleCriterionBreakdown criteria={result.criteria} />`. Behavior and markup for the rows are unchanged (the extraction is a move, not a redesign).
- **`apps/dashboard/components/bands/role-chip.tsx`** (edit): see Wiring.
- **App shell** (the component that already mounts `OrganizationProvider`, where `orgId` and `locale` resolve): wrap its children with `RoleSheetProvider`.

### Sheet content (read-only)

`SheetContent side="right"`, following the shadcn anatomy (header, body, footer; the sheet is the panel, so the body carries no extra card chrome unless a sub-component already does).

- **Header** (`SheetHeader`): `SheetTitle` is the role title. Beneath it, a row mirroring the chip's signals: `TrackBadge`, the status badge (`statusBadgeVariant` plus `assessment.status` labels, as on the page header), the archived badge when archived, the anchor marker when the role is an anchor, and the deviation flag when the computed band differs from the anchor's expected band. `SheetDescription` is `{function} · {team}`.
- **Result block:**
  - When the assessment is complete: the weighting (`dashboard.rating.result.scoreOutOf`) and the band badge (`{assessment.band} {band}`), then `<RoleCriterionBreakdown />`. This reuses the exact result presentation the page already shows.
  - When incomplete: progress only. The `evaluated`/`notEvaluated` line plus `{ratedCount} / {totalCriteria}`. No per-criterion values are shown (matches `RoleResultCard` returning null until complete, and preserves the rating-flow blindness boundary).
- **Profile block:** purpose prose, the responsibilities rendered with the existing `ResponsibilitiesList`, and the family name when set. All read-only.
- **Footer** (`SheetFooter`): a primary **Open role** button (`Button asChild` wrapping a `next/link` `Link` to `/roles/${roleId}`). Activating it closes the sheet and navigates. The standard sheet close control (top-right) and Esc/overlay-click also close it.
- **Help:** reuse existing `dashboard.help.*` popovers next to the concepts they explain (weighting/band, contribution share, anchor role). Never stack two help popovers on one heading; the result heading already carries the score/band help, so the contribution help sits by the breakdown (as it does in the card today).

### Data flow

`RoleSheetContent` runs two reactive queries, keyed on the open `roleId`:

- `api.assessment.roles.getRole` with `{ orgId, roleId, locale }`: title, function, team, track, status, archived, profileComplete, ratedCount, totalCriteria, familyName, anchorRole, purpose, responsibilities.
- `api.assessment.results.getRoleResult` with `{ orgId, roleId, locale }`: complete, score, band, and the `criteria` array for the breakdown.

`orgId` comes from `useOrganization()`, `locale` from `useLocale()` (both available under the app shell). Both queries pass `"skip"` while the sheet is closed (no open `roleId`), so a mounted-but-closed provider does no work.

Loading and empty states:

- While either query is `undefined`: a `Spinner` in the sheet body (with an aria label).
- When `getRole` is `null` (not found or wrong org): a small not-found line reusing `dashboard.roles.detail.notFound`. This is defensive; the Overview only offers roles in the current org.

Close animation: the provider retains the last `roleId` while the sheet animates closed and clears it on exit, so the body does not blank mid-slide. Opening a different role replaces the `roleId` directly.

### Wiring (`RoleChip`)

`RoleChip` reads the sheet context with `useContext` (always called, never conditionally):

- When a `RoleSheetProvider` is present, it renders a `<button type="button">` with the identical chip styling and content, whose `onClick` calls `openRole(role.roleId)`. The accessible name is the role title.
- When no provider is present, it renders today's `<Link href={/roles/${role.roleId}}>` unchanged. This keeps the chip backward-compatible and usable as a plain link elsewhere.

The icon-only anchor marker, the title, the `TrackBadge`, and the deviation badge render the same in both branches; only the wrapping element and its activation differ. No conditional hooks: the context is read unconditionally and the branch is on its value.

`BandLadder`, `BandMatrix`, and `PendingRoles` need no change: they already render `RoleChip`, and the provider in the app shell supplies the opener.

### Animation and layout

- The sheet slide is the shadcn `Sheet` default (no custom motion).
- The breakdown bars and re-sort keep the existing Motion behavior, now living in `RoleCriterionBreakdown` (bar fill animates `width`, rows use `layout="position"`, per `docs/ui-animation.md`). Reduced motion is respected globally via `MotionConfig reducedMotion="user"`; do not bypass it.
- No layout shift: the loading spinner sits in a reserved body area; state changes reveal content below, never reflow the header.
- `docs/ui-animation.md` is re-read before touching the extracted animation (it records FLIP scale distortion, height-vs-box-model clamping, gap collapse, and overflow-vs-corner bugs already shipped once).

### i18n

English is the source locale. New copy goes to `packages/i18n/messages/en.json` first, then is mirrored to every locale `routing.ts` lists (sv, nb, da, fi). Reuse existing keys wherever the exact string already exists, so new keys are minimal:

- Reused: `dashboard.rating.result.*` (scoreOutOf, ratingOutOf, contributionShare, breakdownLabel, bandHighest), `assessment.band`, `assessment.status.*`, `dashboard.roles.evaluated` / `notEvaluated`, `dashboard.roles.detail.notFound`, `dashboard.roles.detail.profileHeading`, `dashboard.help.*` (score, contribution, anchorRole). The responsibilities and family labels reuse the keys `RoleProfileCard` already uses (the plan pins the exact keys when it reads that component).
- New under `dashboard.roleSheet.*` (three keys):
  - `openRole`: the footer action ("Open role").
  - `loading`: the spinner aria label.
  - `progress`: the incomplete-state count line, `"{rated} / {total} criteria assessed"` (the `evaluated`/`notEvaluated` line states the status; this adds the count).

Machine translations for sv/nb/da/fi are drafts, flagged for native review. Non-ASCII strings are written with the editor tools, never via shell `perl`/`sed` (avoids double-encoding); a mojibake grep confirms cleanliness. The i18n parity test must stay green (every locale's key set equals `en.json`).

### Testing

New code ships with tests in the same commit (the pre-commit hook runs the full `turbo run test`).

- **`role-criterion-breakdown.test.tsx`** (new): given a `criteria` array, rows render in contribution-descending order and the share labels match the computed values. This is the behavior previously covered inside `role-result-card.test.tsx`; move or mirror those assertions here.
- **`role-result-card.test.tsx`** (edit): still asserts the card renders the breakdown when complete and nothing when incomplete, now via the extracted component. Keep it green.
- **`role-sheet.test.tsx`** (new): mock `convex/react` `useQuery` (the idiom used in `org-switch-menu.test.tsx` / `role-result-card.test.tsx`). Render `RoleSheetProvider` with a trigger calling `openRole`, then assert: the sheet shows the title, track, and result block for a complete role; shows progress and no per-criterion values for an incomplete role; shows the not-found line when `getRole` is null; and the Open role footer links to `/roles/{id}`.
- **`role-chip.test.tsx`** (new or extended): within a `RoleSheetProvider` the chip renders a button that calls `openRole` on click; without a provider it renders a link to `/roles/{id}`.

All tests follow the existing `NextIntlClientProvider` plus mocked-`useQuery` pattern. The i18n parity test covers the new keys.

## Out of scope

- Editing anything from the sheet: profile fields, AI draft, status transitions, archive, and anchor designation stay on the full role page.
- URL deep-linking or browser-back-to-close (no `?role=` param, no intercepting routes). The opener is in-memory state.
- Changes to `getRole`, `getRoleResult`, the scoring engine, band thresholds, or the point budget.
- `BandLadder`, `BandMatrix`, `PendingRoles` internals (they render `RoleChip` unchanged).

## Edge cases

- **Incomplete role:** result block shows progress only, no values, no breakdown (mirrors the card).
- **Role with no family:** the family label is omitted.
- **Not an anchor / no deviation:** those badges are omitted, as in the chip.
- **Archived role:** shows the archived badge; still read-only; Open role leads to the page where archive consequences are stated.
- **Query returns null mid-open** (role archived or removed in another tab while the sheet is open): falls back to the not-found line.
- **Reduced motion:** the global `MotionConfig` already neutralizes the bar and slide animations; no special-casing.
