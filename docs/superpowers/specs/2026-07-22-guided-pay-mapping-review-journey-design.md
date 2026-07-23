# The guided kartläggning journey (redesign of the run experience)

Redesign of the whole kartläggning experience after Christian's verdict on the first analysis surfaces (too number-dense, unstructured, too close to the competitor) and the verified process research in `docs/lonekartlaggning-process-och-kravbild.md` (24/25 claims adversarially confirmed, 0 refuted). The run becomes a guided journey: the overview is the hub that always names the next step, and the analysis is ONE wizard that walks the user through the statutory process in the parts-canonical chapter order. Numbers become plain-language sentences; data moves behind disclosure.

Decisions locked with Christian: whole-journey scope; pure wizard (no master-detail); one journey with chapters (the lika/likvärdigt header submenu dies); the queue steps are the groups requiring action; the two missing statutory moments (Bestämmelser & praxis, Samverkan) are IN, deliberately light; plus the research-driven adjustments (no de minimis honesty, conditional previous-year evaluation, sharpened help copy).

Everything runs on the existing backend foundation: the gap engine, `getPayMappingGap`, `payMappingGroupAnalyses`, the upsert/gate mutations and their audit trail are reused; the backend grows only the praxis scope, the samverkan fields, and the gate extension.

## 1. Overview becomes the hub

Layout top-to-bottom (replaces the current seven blocks):

1. **The journey card** (new `pay-mapping-journey-card.tsx`, replaces `pay-mapping-documentation-card.tsx` and absorbs the flag-summary KPI's numbers). A `WidgetCard` (no expand) showing the run's four chapters as a compact journey: *Kom igång & samverkan -> Bestämmelser & praxis (x av y) -> Lika arbeten (x av y) -> Kvinnodominerade arbeten (x av y)* with per-chapter done-counts and states (not started / pågår / klar), plus ONE primary CTA that always names the next step: "Fortsätt granskningen" (links to `/analysis`; the journey resumes at the first undone step), "Slutför kartläggningen" when the gate is met (calls `completePayMappingRun`, toast, same confirm-free primary as today), or the completed state with "Återöppna" behind the existing AlertDialog. The remaining-count line and gate preview reuse the documentation card's verified preview math, extended with praxis + samverkan (mirrors the server gate exactly).
2. **Läget**: a two-card row. (a) The org gap reframed sentence-first: "Kvinnor tjänar i snitt {x} % mindre än män i hela kartläggningen." (or the more/none variants, reusing the direction-branch pattern from bandContext) above a `MeanComparisonBars` visual (see 6) with the two means; the flag chip stays beside the heading. (b) The equality clock unchanged.
3. **Statistik**: a section heading + the three existing charts (donut, quartiles, age), unchanged.

Deleted from the overview: `FlagSummary` (its counts live in the journey card), the standalone documentation card.

## 2. One route, one journey

- `/pay-mappings/[slug]/analysis` renders the journey (`pay-mapping-review.tsx`). The `/analysis/likvardigt` route, `pay-mapping-analysis-tabs.tsx`, and the site header's animated second row are DELETED (site-header simplifies back to one row; its tests updated). `PayMappingTabs` (Översikt/Analys/Rapport) and `payMappingSubPageKey` are unchanged.
- Step position is client state (no step URLs in V1). Entering Analys always lands on the first undone actionable step; when everything is done it lands on the finish screen. The jump menu reaches any step.
- Step transitions animate with a direction-aware slide (Motion, mirroring the onboarding wizard's pattern; read `docs/ui-animation.md` first; `MotionConfig reducedMotion="user"` already governs).

## 3. The queue (pure derivation, exported for tests)

New `review-queue.ts` (components/pay-mapping): `buildReviewQueue({gap, analyses, samverkan, praxisAreas, hasPreviousCompletedRun})` returns the ordered steps:

1. `start` (Kom igång & samverkan). Done when both samverkan fields are non-empty.
2. Chapter **praxis**: one step per area from `PRAXIS_AREA_KEYS` (see 5): `payPolicy`, `collectiveAgreements`, `benefits`, `payPractices`, plus `previousActions` ONLY when `hasPreviousCompletedRun` (derived client-side from `listPayMappingRuns`: any other run with status `completed` and an earlier `referenceDate`; the journey subscribes the same query the header switcher already holds, so no new fetch). Done per area = its analyses row (scope `praxis`) has `done: true`.
3. Chapter-intro step for **lika** (concept explanation; no done-state, skipped by resume logic).
4. Chapter **lika**: one step per documentation-requiring lika group (`likaGroupRequiresDocumentation(flag)`), attention-sorted (worst first). Done = its analyses row.
5. Chapter-intro step for **likvärdigt** (kvinnodominerad explained inline).
6. Chapter **likvardigt**: one step per women-dominated group with comparisons, engine order. Done = its analyses row.
7. `finish`.

Resume = first step with an unmet done-state (intros never count); progress figures count actionable steps only. The queue is deterministic per run (frozen snapshot + static areas).

## 4. Start step: Kom igång & samverkan

- Plain-language intro: what a lönekartläggning is, the annual cycle (undersök -> analysera -> åtgärda -> följ upp), and that the journey produces the statutory documentation. One HelpMorphButton per new concept.
- The samverkan form (two fields, structured free text): **Vilka deltar i samverkan?** (participants, e.g. fackliga representanter och roller) and **Hur sker samverkan?** (description). Autosaves on blur/debounce like the group form; the samverkansredogörelse is a hard documentation requirement (13-14 §§) so the gate requires both non-empty. Helper text: samverkan ska ske i alla steg (11 §), and a note that a kollektivavtalsbunden organisation har rätt till information (12 §).
- Storage: `payMappingRuns.samverkan: v.optional(v.object({ participants: v.string(), description: v.string() }))`. New `setPayMappingSamverkan` orgMutation (rejects on completed run with `payMappingRunCompleted`; trims; deletes the object when both fields empty). Audit: new event `payMapping.samverkanUpdated` with payload `{runId}` only: the participants are names by design and never enter the trail (marker event, precedent `payMapping.runReopened`). Wire: `getPayMappingRunBySlug` returns `samverkan` (object or null); `PayMappingRunDetail` extended.

## 5. Praxis chapter (8 § punkt 1)

- `PRAXIS_AREA_KEYS` in `@workspace/constants` (like the reason taxonomy): `payPolicy`, `collectiveAgreements`, `benefits`, `payPractices`, `previousActions`. i18n per area under `dashboard.payMapping.review.praxis.<key>.{title, question, helper}`; en questions (drafts for the other four locales):
  - payPolicy: "Are the pay policy and pay-setting criteria gender-neutral and known to employees?"
  - collectiveAgreements: "Are collective agreements and local pay agreements applied the same way for women and men?"
  - benefits: "Are benefits, allowances and variable pay granted on gender-neutral grounds?"
  - payPractices: "Is pay-setting practice gender-neutral at hiring, promotion and during parental leave?" (helper cites the research: parental-leave pay lag is normally NOT an objective reason)
  - previousActions: "How were the measures planned in the previous pay mapping carried out?" (helper: the documentation must evaluate last year's planned measures)
- Step card anatomy: the question as the heading, helper text, a two-choice control ("Inga brister funna" / "Brister eller otydligheter funna", radio-style buttons with aria-pressed semantics), a textarea (required when brister; optional otherwise), and the wizard actions ("Klarmarkera och gå till nästa" disabled until a choice is made and, when brister, a non-empty note, with the requirement stated in muted text; "Hoppa över"; "Föregående").
- Storage: reuse `payMappingGroupAnalyses` with `scope` widened to `v.union("lika","likvardigt","praxis")` and a new optional `finding: v.optional(v.union(v.literal("none"), v.literal("found")))`. Upsert validation for scope `praxis`: groupKey must be in `PRAXIS_AREA_KEYS`; `reasons` must be empty (invalidInput otherwise); `done: true` requires a `finding`, and `finding === "found"` requires a non-empty trimmed note. `finding` joins `GROUP_ANALYSIS_AUDIT_FIELDS` (diffed; label in all 5 locales). The `previousActions` key is always accepted server-side (applicability is a client/gate concern).
- Gate extension in `completePayMappingRun`: every applicable praxis area (the four, plus `previousActions` when the org has an earlier completed run, derived server-side the same way) has a done row, AND samverkan is filled, AND the group requirements as today.

## 6. Group steps (the heart)

Shared card anatomy for both group chapters (new `review-group-step.tsx`):

- **Heading**: group label (roleTitle · level) + flag chip + band badge.
- **The finding as one sentence** (i18n with ICU): lika examples: "Kvinnorna i gruppen tjänar i snitt 8,2 % mindre än männen (3 kvinnor · 4 män)." / the more/equal variants / ⚪: "Gruppen har bara kvinnor (2 personer), så det finns ingen jämförelse att göra. Motivera varför gruppen ser ut så." Likvärdigt: "Marketing · Mid är kvinnodominerat (75 % kvinnor). Tre yrken med samma eller lägre värdering tjänar mer i snitt." followed by a compact plain-language comparator list (one line per comparator: label, band, "+9 300 kr/mån"), replacing the seven-column table as the primary presentation.
- **`MeanComparisonBars`** (new primitive `mean-comparison-bars.tsx`): two horizontal bars (kvinnor/män group means, gender tokens, money labels, accessible text). Reused by the overview's Läget card. Omitted for ⚪ groups (nothing to compare) and for likvärdigt (the comparator list carries the numbers).
- **"Vad förklarar skillnaden?"**: the existing `PayMappingGroupAnalysisForm` re-skinned: chips + textarea keep their autosave exactly; the Klarmarkerad switch is REMOVED (the wizard's primary button owns done). The reasons help body is extended with the research's caveats: what does NOT count (a bare reference to collective agreements; parental-leave-related lag) and the conditions (experience applied consistently; market pay gender-neutral).
- **"Visa underlag"** (a Collapsible, closed by default): the member table + scatter for lika; the full comparison table + band-context line + scatter over the comparison set for likvärdigt (all existing components, relocated into `pay-mapping-group-underlag.tsx`). The likvärdigt help mentions that the scatter shows lönespridning, which the statutory analysis also looks at.
- **Actions**: `[Föregående] [Hoppa över] [Klarmarkera och gå till nästa ->]`. The primary calls the existing upsert with `done: true` then advances (toast per the existing done-toggle rule); disabled with the stated requirement until documented (requiring groups). A previously done step shows its saved state plus "Ångra klarmarkering" (upsert `done: false`). Locked (completed run): everything read-only + the existing lockedHint.

## 7. No de minimis honesty

- The **jump menu** (`review-jump-menu.tsx`, a Sheet with search) lists EVERY step grouped by chapter: praxis areas, ALL lika groups (including ✅ ones, each with its actual gap: "2,1 % · utan anmärkning") and all women-dominated groups (including zero-comparator ones: "inga högre betalda jämförelser"). Any group can be opened and documented (a ✅ group's step renders with `requiresDocumentation: false`, so klarmarkering is optional/free); non-queue groups do not affect progress counts or the gate.
- The **finish screen** (`review-finish.tsx`) mirrors the documentation parts: samverkansredogörelsen, praxis results per area, ALL groups listed with gap + status (dokumenterad / utan anmärkning / motiverad), a note that åtgärder, kostnadsberäkning och tidsplan (senast tre år) tillkommer i handlingsplanen (M7), and the primary "Slutför kartläggningen" (gate-checked server-side) or the completed state.
- A help text at the lika chapter intro explains: every difference is analyzed regardless of size (DO), the 5/10 % flags are the tool's prioritization, and groups are formed from actual work content (roles), not titles. The likvärdigt intro explains kvinnodominerad with 60 % as DO's riktpunkt (not statute text).

## 8. What is deleted (no legacy)

`pay-mapping-analysis.tsx` + its test (replaced by the review family), `pay-mapping-analysis-tabs.tsx` + the site-header second row + related tests/keys, the `/analysis/likvardigt` route, the master-detail i18n (gap.tabs.*, searchGroups, allDone, noGroups, comparisonCount, likaTitle/likvardigtTitle, the view descriptions) except keys the underlag/jump menu still uses (audit each key; the sweep greps must be clean in all 5 locales). `FlagSummary` and the documentation card as standalone components. The scatter, member table, comparison table, band-context line, group-analysis form (minus switch), `PayGapFlagBadge`, `groupMembers`, and all engine/backend code survive.

## 9. Backend delta (small)

1. `tables.ts`: scope union + `finding` on `payMappingGroupAnalyses`; `samverkan` object on `payMappingRuns`.
2. `analyses.ts`: praxis validation per section 5; `finding` in the audit diff.
3. `runs.ts`: `setPayMappingSamverkan` + audit event + wire field; `completePayMappingRun` gate extension (praxis areas + samverkan).
4. `@workspace/constants`: `PRAXIS_AREA_KEYS`.
5. Engine and `getPayMappingGap` untouched. `bunx convex codegen` after schema changes.

## 10. i18n and help

All new copy in en first + sv/nb/da/fi drafts: the journey card, start step + samverkan, praxis areas, finding sentences (ICU, direction-branched, never a signed percent in prose), comparator lines, wizard chrome (steg x av n, chapter names, buttons, hints), jump menu, finish screen, and the new/updated help bodies (payGapReasons caveats, lika/likvärdigt chapter intros, 60 % riktpunkt, samverkan, praxis per area). No em dashes. Deleted keys removed from all 5 locales. Nordic drafts flagged for native review.

## 11. Testing

- `review-queue.ts`: pure tests (ordering, conditional previousActions, resume position, done-state per source, progress counts exclude intros).
- Backend: praxis upsert validation (area key, empty reasons, finding/note requirements), samverkan mutation (set/clear/locked/audit marker), gate extension (praxis + samverkan + previousActions applicability).
- Components: start step autosave + gate hint; praxis step choice/note gating; group step sentence variants (less/more/none/⚪), primary-button gating, skip/previous/undo, locked state; jump menu lists all groups with gaps + opens non-queue groups; finish screen contents + gated Slutför; journey card states + CTA targets; overview reshaping; site-header simplification. Loading states per the skeleton rules (wizard chrome real, sentence/bars as bars).
- i18n parity + audit label coverage + the final dead-key greps.

## Out of scope (deliberate)

M7 handlingsplan (åtgärder, kostnadsberäkning, tidsplan, and next year's utvärdering feeding previousActions with real data), the report (M8) which will render the same documentation parts, lönespridningsmått, manual "brukar anses kvinnodominerat" marking, EU-lönerapporten (Swedish implementation postponed and contested), AI insights.
