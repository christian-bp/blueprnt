# Person page: "Pay compared with the role" chart

**Date:** 2026-07-11
**Status:** approved design, not yet implemented
**Owner surface:** `apps/dashboard/components/people/` (person detail page)

## 1. Goal

Give the HR user, on a person's detail page, an at-a-glance answer to "where does this person's pay sit relative to the people doing the same job?", with the person's level visible in the picture. This is a deliberately small slice of the person-vs-peers idea: same-role scope only. The same-band (work of equal value) scope belongs to the analysis pillar (Phases 3 to 5 of the V2 salary spec) and is out of scope here; this design leaves a visible seam for it.

## 2. Decisions

| # | Decision | Rationale |
|---|---|---|
| 1 | Peer group = everyone with an **active assignment on the same role** | Always available once people are classified; no dependency on evaluations. |
| 2 | Levels are **visible in the chart** (one row per level of the role's track) | The user asked for the level dimension to be explicit; a level ladder maps naturally to categorical rows. |
| 3 | Comparison metric = **FTE-adjusted total monthly comp** via the existing `fteTotalMonthlyComp` helper (`packages/constants/src/pay.ts`) | The canonical comparison metric per the V2 salary spec (§4.3, §6): total comp, FTE-adjusted, derived live, never stored. One helper, one formula. |
| 4 | Each peer contributes their **latest pay record by `payYear`** | Pragmatic mid-import-cycle: a person missing this year's record still compares with last year's. The footnote states this basis. |
| 5 | **Same-currency only**: peers whose latest record is in a different currency than the viewed person's are excluded, and the excluded count is returned and shown | Cross-currency amounts are not comparable; silent exclusion would misrepresent coverage. |
| 6 | The tooltip **names the person** (revised 2026-07-11): each point carries `displayName` + `externalRef` and the FTE-adjusted basic/variable split and pay year. The viewed person shows their own name in the tooltip in the brand color (matching the brand ring on their dot); peers show their name, or their pseudonym when the org's Pseudonymize names setting is on (applied client-side via `displayNameFor`, exactly as the People register does). | Originally built anonymous (`{ level, amount, isSelf }` only), but HR needs to see who an outlier is to act on it. This is an HR-only, org-scoped read; HR already sees each person's name and salary on their own page, and the existing pseudonymize lever governs orgs that want names hidden. The query result still never enters the audit trail (where identity and salary are forbidden). |
| 7 | **Dots are colored by gender** (revised 2026-07-11): the query returns each point's gender and the chart fills dots man = blue / woman = orange, with the viewed person marked by a brand ring + the dashed line, and a Man / Woman legend. | The tool's core purpose is the men-vs-women pay gap, so gender is the natural color lens; HR already sees gender in the People register. **The two colors are design-system tokens (`--gender-man` / `--gender-woman`, validated colorblind-safe) reused by every gender-split chart, including the future lönekartläggning pillar.** Caveat: this is a small same-role sample, a visual cue, not the statutory gap analysis (which aggregates with small-group masking and significance); that stays the separate pillar. Statistics (median/quartiles, dominance, masking) are still NOT computed here. |
| 8 | Scope control renders as a single static "Same role" chip | The seam: when the analysis pillar lands, "Same band" joins it as a real toggle (only people on roles with completed evaluations). |

## 3. UI

- **Placement (revised 2026-07-11):** its own `Card` in the left column, directly below the identity/classification card (not inside it: the identity card is for facts about the employee, the chart is a distinct analysis). The left column has the width a dot plot needs; the right salary rail keeps the history list. The person page's outer loading skeleton renders `PayComparisonSectionSkeleton` as a matching sibling card so the column height is reserved up front.
- **Form:** a horizontal dot plot built with the shadcn chart kit (`@workspace/ui/components/chart` + recharts, same stack as the overview's roles-per-band chart). X axis = FTE-adjusted total monthly pay. Y axis = the levels of the role's track, ordered per `TRACK_LEVELS` with the highest level on top; a level string not in the ladder (data drift) gets a trailing row at the bottom rather than being dropped. Dots are filled by gender (`--gender-man` / `--gender-woman`); the viewed person's dot carries a `var(--brand)` ring.
- **Header:** section heading plus a `HelpMorphButton` (`dashboard.help.*` key) explaining FTE adjustment in plain language. One help popover on this heading only, per the help-placement rule.
- **Footnote:** one muted line stating the basis: FTE-adjusted total monthly pay, latest recorded year per person. When `excludedCount > 0`, a second line states how many peers were excluded for having pay in another currency.
- **Tooltip (revised 2026-07-11):** the person's name (the viewed person in brand color; peers pseudonymized when the org setting is on), level and pay year, the FTE-adjusted total, the basic vs variable split, and for peers the signed gap to the viewed person. A dashed brand reference line marks the viewed person's pay so each peer's horizontal distance reads against it. All figures use the locale currency formatter. Gender appears in the tooltip too, as a small colored swatch (the same gender token the dot uses) plus the Man / Woman label, so gender is stated, not conveyed by dot color alone.
- **Skeleton:** while the query is `undefined`, a fixed-height skeleton block occupies the chart slot (same height as the loaded chart) so nothing reflows. The heading and chip are static chrome and render as their real components.
- **Reduced motion / animation:** no custom animation; recharts defaults inside `ChartContainer`, consistent with the existing chart.

## 4. Data

One new org-scoped Convex query in `packages/backend/convex/people/pay.ts`:

```
getRolePayComparison({ orgId, personId }) ->
  | { status: "unclassified" }
  | { status: "noSalary" }
  | { status: "ready",
      currency: string,
      excludedCount: number,
      points: Array<{ publicId, displayName, externalRef: string | null,
                      level, basic, variable, amount, payYear, isSelf }> }
```

Server-side steps:
1. Auth + org scoping, same pattern as the existing `people/pay.ts` queries.
2. Resolve the viewed person's active assignment (`by_person`, `endedAt` absent). None: `status: "unclassified"`.
3. Resolve the viewed person's latest pay record (`by_person`, max `payYear`). None: `status: "noSalary"`.
4. Load all active assignments on the role (`by_role`). Archived peers are excluded; the viewed person is always included, archived or not (their page is the one being read). Assignments count regardless of `levelSource`: a suggested level is still the current best placement, consistent with the classification block showing it.
5. For each person: latest pay record by `payYear`; skip people with none. Keep records whose `currency` equals the viewed person's; count the rest into `excludedCount`.
6. `amount = fteTotalMonthlyComp(basicMonthly, components, person.ftePercent)`, rounded; `basic = fteTotalMonthlyComp(basicMonthly, [], ftePercent)` rounded; `variable = amount - basic` (so the parts always reconcile to the plotted total). All FTE-adjusted, consistent with the axis.
7. Return points with `publicId`, `displayName`, `externalRef`, `gender`, `level`, `basic`, `variable`, `amount`, `payYear`, `isSelf`. Identity is for the tooltip (decision #6, client applies pseudonymization); gender is for the dot color (decision #7). Nothing else (no internal id).

Notes:
- Read-only query: no audit row (the audit convention governs state-changing mutations).
- Derived values only; nothing new is stored (ADR-0002 spirit: compute on read).
- The level string is role-level data, not person identity. With `isSelf` present, points are otherwise unattributable.

## 5. States

| State | Render |
|---|---|
| Query loading | Skeleton block in the chart slot, real heading + chip |
| `unclassified` | One muted line: the comparison appears once the person is classified and has a recorded salary |
| `noSalary` | Same precondition line (one shared message covers both preconditions) |
| `ready`, only self has a point | One muted line: this person is the only one in the role with a recorded salary (chart hidden; a one-dot plot says nothing) |
| `ready`, 2+ points | The dot plot, footnote, and (if `excludedCount > 0`) the exclusion line |

## 6. i18n

New keys under `dashboard.people.payComparison.*` (heading, scope chip, precondition line, only-person line, footnote, excluded-count line with ICU plural, tooltip labels) plus the help copy under `dashboard.help.*`. English first in `en.json`, mirrored to sv, nb, da, fi in the same change; non-English strings are drafts flagged for native review. No text hardcoded in the component.

## 7. Testing

- **convex-test (`packages/backend`):** org isolation (a caller from another org gets nothing), each status branch, latest-year selection, currency filtering + `excludedCount`, FTE adjustment applied, archived peers excluded, and the exact point shape (identity + gender + basic/variable split + payYear present, internal id absent).
- **Component test (`apps/dashboard`):** each of the five states renders its copy; no peer identity string appears in the DOM; the skeleton branch renders the static chrome. Chart SVG internals stay untested (vendor-composed), same policy as the overview chart.
- The i18n parity test and audit-label coverage test are unaffected (no new audit events).

## 8. Out of scope

- Same-band scope (analysis pillar; the chip is the seam).
- Gap statistics: median/quartiles, gender-dominance, small-group masking, significance (all the gap engine's job). Gender coloring is now in scope (decision #7); the statistics are not.
- Identity in tooltips (never).
- Any schema change (none needed).

## 9. Build order (single change)

1. Convex query + convex-test coverage.
2. Chart section component (read the dataviz skill before writing the chart code) + component tests + skeleton.
3. i18n keys in all five locales + help copy.
4. Wire into `person-detail.tsx` under the classification block.
