# Fas 6: Orden hinner ikapp (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The product's own words catch up with the model it now runs: the user guide describes the surfaces that actually exist, the three concepts with no page get one, every domain term the program introduced explains itself in place, the assistant stops asserting a product it no longer serves, and every locale is read once against sv and en so the go-live checklist's native-review entries can be retired.

**Architecture:** Nothing shipped in phases 1 to 5 changes. This phase writes: MDX in five locales (corrections to eleven existing pages, three new pages with their nav entries), `dashboard.help.*` pairs for the concepts the program left unexplained, corrections to the assistant's system knowledge and to the context glossaries it declares as its source, and one cross-locale read. Every corpus change is followed by `docs:sync` in the same commit, because the assistant otherwise answers from the previous text AND the previous embeddings with no test to catch it.

**Tech Stack:** as fas 5. Additionally `bun run docs:sync` and `bun run docs:eval` from `apps/dashboard`.

**Spec:** `docs/superpowers/specs/2026-08-18-adaptable-role-evaluation-design.md` §10.1 Fasning v2 (fas 6). Its second bullet (metodbilaga growth) shipped 2026-08-27 and is out of this plan. Behind it: `docs/rollvardering-masterdokument.md` §5-7, §10.1, §12-14, §17; ADR-0019 and ADR-0020 for the corpus and its index.

## Global Constraints

Same as fas 5's (five-locale production quality, framing-prose law, wire-level weight firewall on assessor surfaces, the audit law, reading floor, collision law, skeletons, tests-with-code, Biome zero, `bun run test` and never `bun test`, per-task commits). Additionally:
- **Every change under `content/docs/` ends with `bun run docs:sync` from `apps/dashboard`, in the SAME commit.** The sync is incremental, so an unchanged page costs no embedding call.
- **The corpus contract is `apps/dashboard/lib/docs/docs-guards.test.ts`,** eleven guards. A new page needs all five locales, strict frontmatter, a nav entry, resolving links and anchors, a heading-level and internal-link sequence matching `en` position for position, no inline markdown in headings, no duplicate anchors, and no em dash. A new documentation RULE ships as a guard there, never as a convention.
- **Locale files are edited `en` first,** then mirrored to sv, nb, da and fi. Nothing is ever marked draft or pending native review; the agent authoring a string owns its production quality in every locale.
- **Never publish a number the code owns** unless the page also says where the reader's own value lives. Today's threshold retune changed twelve numbers and needed no corpus edit precisely because no page states them.

---

### Task 1: The corpus catches up with what shipped

**Files:**
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/` on eleven slugs: `method-appendix-pdf`, `method-documentation`, `weighting-and-point-budget`, `ai-weighting-review`, `evaluating-a-role`, `adjusting-a-rating`, `roles-register`, `troubleshooting-model-and-evaluation`, `model-overview`, `navigating-the-app`, `glossary`, plus `collaboration`, `rules-and-practice`, `equal-work`, `equivalent-work` for the retired tab row

**Interfaces:**
- Consumes: the shipped surfaces as they are today. Verify each against the component before writing, never against this list.
- Produces: a corpus with no sentence describing a surface that no longer exists.

- [ ] Verify each defect empirically against the component named, and report the found state before writing. The known set: the appendix export moved to the Approval chapter and became a card (`app/(app)/model/approval/page.tsx:83`); the appendix has six sections and a contents page, not five (`components/pdf/method-appendix.tsx:198-282`), and the page omits the shared scale, the anchor ladders, the zone grouping with its profile gates, and the materiality decision; `method-documentation.mdx:92-94` says nothing in the app edits the level rules while the same page documents the panel that does; the chapter actions moved from a top band to a closing row at the chapter's foot (`components/chapter-action-slot.tsx`); the rating flow always opens at criterion 1 pre-filled and no longer resumes at the gap (`components/rating/rating-stepper.tsx:138`); the register's level cell has three branches including a "Rate role" link (`components/roles/role-table-row.tsx:138-164`); `troubleshooting-model-and-evaluation.mdx:96-99` instructs a control that does not exist; the model chapters became sidebar rows; four pay-mapping pages still say "tabbed as" for a tab row that was deleted.
- [ ] Rewrite each in `en` first, then mirror to sv, nb, da and fi. Keep the heading sequence and the internal-link sequence unchanged wherever the correction is prose only, so guard 8 stays green without restructuring.
- [ ] Retire the `model.template` key from all five message files. Guard 6 derives the glossary's "Template" heading from that namespace, so the retired standard template stops being documented as a live term by accident. Delete the glossary entry with it.
- [ ] Run `bun run docs:sync` from `apps/dashboard`.
- [ ] Tests: `bun run test` green including all eleven docs guards; grep-pin that no page contains "top row", "tabbed as", or "resumes at".
- [ ] Commit: `docs(guide): the guide describes the surfaces that exist`

### Task 2: The Approval chapter gets its own page

**Files:**
- Create: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/model-approval.mdx`
- Modify: `apps/dashboard/lib/docs/docs-nav.ts` (`DOCS_NAV`, section `model`, after `method-documentation`)
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/method-documentation.mdx` (sheds its approval tail)

**Interfaces:**
- Consumes: `app/(app)/model/approval/page.tsx` and the four components it renders.
- Produces: one page covering, in the order the chapter renders them, the consequence panel, the method appendix card, the approval card, and the Level thresholds panel. No new nav section: `model` already exists.

- [ ] Author `en` covering: the consequence analysis and that it is silent when it has nothing to say; the appendix card with its DRAFT and FINAL states; the twelve checks in their two groups with the per-check remedy naming the chapter that fixes it; approval as a status that gates every assessment and reopens on a method-affecting edit; restore to last approved and that its confirm lists every change it will undo; the Level thresholds panel, collapsed behind "Adjust the thresholds", its three validity rules, and that saving reopens the approval.
- [ ] State the shape of the default ladder (progressive, the gap widening toward the top) and send the reader to the panel for their own organization's numbers. Do NOT publish the twelve values; a page that did would have been wrong within a day of the last retune.
- [ ] Move `method-documentation.mdx`'s approval tail onto the new page and leave that page about the Method chapter alone.
- [ ] Mirror to sv, nb, da, fi; add the nav entry; run `bun run docs:sync`.
- [ ] Tests: docs guards green (locale parity, frontmatter section equals the nav section, links and anchors resolve in every locale, heading sequence matches `en`).
- [ ] Commit: `docs(guide): the approval chapter gets its own page`

### Task 3: The twelve levels and four zones get their page

**Files:**
- Create: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/levels-and-zones.mdx`
- Modify: `apps/dashboard/lib/docs/docs-nav.ts` (section `evaluation`, after `score-and-levels`)
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/levels-views.mdx:28-30` (which defers this to in-app help today)

**Interfaces:**
- Consumes: `packages/backend/convex/evaluationModel/zoneContent.content.{en,sv,nb,da,fi}.ts`, which already carries per zone a `shortName`, `name`, `character`, `typicalProfile` and `summary`, plus `levelFunctions` for twelve cells. `summary` and `levelFunctions` have no consumer in the app; this page is their first, at zero authoring cost in any locale.
- Produces: the four zones described, the three positions inside a zone, and the profile requirement explained as a cap that never lifts.

- [ ] Author `en` from the existing zone content rather than paraphrasing it, so the page and the app cannot describe a zone differently.
- [ ] Define **profile criterion** here in full: the weight 4 or 5 set, never a working-conditions criterion, and why a role can be held at a lower zone's top level on a high total alone. This term is the most load-bearing undefined term in the placement rule.
- [ ] Point `levels-views.mdx` at the new page instead of deferring to in-app help.
- [ ] Mirror to sv, nb, da, fi; add the nav entry; run `bun run docs:sync`.
- [ ] Tests: docs guards green; grep-pin that the page names no threshold value.
- [ ] Commit: `docs(guide): the zones and levels are explained where they can be read`

### Task 4: The criteria library gets a reference

**Files:**
- Create: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/criteria-library.mdx`
- Modify: `apps/dashboard/lib/docs/docs-nav.ts` (section `model`, after `criteria-and-scale`)

**Interfaces:**
- Consumes: `packages/backend/convex/evaluationModel/criteriaLibrary.ts` (`CRITERIA_LIBRARY_KEYS`, `LIBRARY_DIMENSION`, `LIBRARY_OVERLAP_PAIRS`) and the five locale content modules.
- Produces: the 21 criteria named and one-line-defined under their four dimensions, with the selection rules and the overlap pairs stated.

- [ ] Author `en`: four sections, one per dimension, each listing its criteria (competence 5, effort 5, responsibility 7, working conditions 4) with the criterion's own `name` and a one-line definition drawn from its `fullDefinition`. Take the text from the library modules verbatim where it fits; never re-author what the library already says.
- [ ] State the selection rules the picker enforces: 6 to 8 criteria, per-dimension caps 2/2/3/1, and that the picker refuses past a cap.
- [ ] List the declared overlap pairs and say what an overlap note is for.
- [ ] Mirror to sv, nb, da, fi, taking each locale's text from that locale's own library module; run `bun run docs:sync`.
- [ ] Tests: docs guards green; a new guard in `docs-guards.test.ts` asserting every `CRITERIA_LIBRARY_KEYS` entry's name appears on the page in every locale, so a library revision cannot leave the reference behind.
- [ ] Commit: `docs(guide): the criteria library becomes readable outside the picker`

### Task 5: Every term the program introduced explains itself

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (`dashboard.help.*`)
- Modify: `apps/dashboard/components/model/`, `components/rating/`, `components/levels/`, `components/roles/` and `components/role-sheet.tsx` (+ tests)
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/glossary.mdx`

**Interfaces:**
- Consumes: the existing `HelpMorphButton` and the `dashboard.help.*` namespace.
- Produces: a help body on every surface that introduces a domain term, and a glossary entry for every shipped concept.

- [ ] Mount the help pairs that already exist but are orphaned or misplaced: `calibrationLabel/Body` on the calibration marker, `anchorRoleLabel/Body` on the ladder chip, and `profileRequirementLabel/Body` where a profile requirement is actually stated. `level-rules-panel.tsx:424` renders help from `dashboard.model.levelRules.*` instead of `dashboard.help.*`, which escapes the cap test; move it into the help namespace.
- [ ] Author the missing pairs, one per concept and not one per surface: **weight point and point budget** (the Weighting chapter has no help at all), **profile criterion**, **criteria library and the selection rules** (on the picker dialog title), **method drift**, and **confirmed placement**. Every body is at most two sentences: what the thing is, then the one boundary that prevents the dominant mistake.
- [ ] Respect the anchoring law: help sits only after a title or heading, never beside body text or a control, and never two popovers on one heading. The role sheet has zero help today and the densest cluster of unexplained terms; place each concept's help beside its own heading there.
- [ ] Add the missing glossary headings: profile criterion, placement, zone profile requirement, method check, overlap pair, consequence analysis, restore to last approved, method drift, confirmed placement. Guard 6 only enforces terms carrying a `model.*` or `assessment.*` i18n key, which is why these slipped through.
- [ ] Mirror every new string to sv, nb, da, fi under the 200 character `en` cap and 240 elsewhere; run `bun run docs:sync`.
- [ ] Tests: `messages.test.ts` parity and help-body caps green; a component test per newly mounted help asserting the button and its body render; docs guards green.
- [ ] Commit: `feat(model): every term the program introduced explains itself`

### Task 6: One cross-locale read

**Files:**
- Modify: `packages/backend/convex/evaluationModel/criteriaLibrary.content.{nb,da,fi}.ts`, `zoneContent.content.{nb,da,fi}.ts`, `packages/i18n/messages/{nb,da,fi}.json`, `apps/dashboard/content/docs/{nb,da,fi}/`
- Modify: `docs/go-live-checklist.md`

**Interfaces:**
- Consumes: sv and en as the authored source pair.
- Produces: nb, da and fi read once against them, and the checklist's native-review entries retired under the ownership policy.

- [ ] Read the nb, da and fi criteria library against sv and en, criterion by criterion, looking for false friends, register drift, and terminology inconsistent with the glossary. The known pattern to check first: `assessmentQuestion` drifting from its own criterion's name, and Finnish terminology fragmenting across criteria that should share a term.
- [ ] Do the same for `zoneContent` and for the `dashboard.*` strings the program added.
- [ ] Fix what is wrong. Keep international job titles in English in the Nordic locales; the mix is idiomatic and is not a defect.
- [ ] Retire every "native review of machine-translated locale drafts" entry in `docs/go-live-checklist.md` that this pass covers, and say in the entry's place that ownership is in-house per the translation policy. Leave any entry this pass did not reach, and name what it was.
- [ ] Tests: `bun run test` green; report per locale what was changed and what was read and found sound, so the pass is auditable rather than asserted.
- [ ] Commit: `fix(i18n): the Nordic locales are read against their source`

### Task 7: The assistant stops describing a product it no longer serves

**Files:**
- Modify: `packages/backend/convex/assistant/knowledge.ts`
- Modify: `docs/contexts/evaluation-model/CONTEXT.md`, `docs/contexts/assessment/CONTEXT.md`, `CONTEXT-MAP.md`
- Modify: `apps/dashboard/content/docs/{en,sv,nb,da,fi}/assistant-capabilities.mdx` if its promises no longer hold

**Interfaces:**
- Consumes: the corpus as tasks 1 to 5 leave it.
- Produces: a system prompt whose every domain claim is true, and glossaries that match the domain language the prompt declares as its source.

- [ ] Fix the false statement first: `knowledge.ts:335` calls a criterion "one dimension a role is evaluated on", while dimension is now reserved method law for the fixed four. A criterion belongs to a dimension.
- [ ] Complete the statements a reader would take as complete: the level concept never says twelve, never mentions zones, and never mentions the profile requirement, so the assistant cannot answer why a role was capped. The `/model/approval` description omits the consequence panel, the thresholds panel, restore, approval as a status, and reopening.
- [ ] Add what the prompt says nothing about: approval status, the twelve-check checklist, the blind stepper, completion as the reveal, calibrated, method drift, and anchor roles. Keep it to the core-concepts register; depth belongs in the corpus that `search_docs` reaches.
- [ ] Update the context glossaries the prompt names as its source (`docs/contexts/`), which have not moved since the program started. Neither `CONTEXT-MAP.md` nor either CONTEXT has a Zon entry despite zones being structural law since ADR-0022.
- [ ] Run `bun run docs:eval` from `apps/dashboard` and compare recall@5 against ADR-0020's recorded numbers (en 13 of 13, sv 12 of 13 at threshold 0.65). Report the numbers; if recall fell, say which probe and why before changing anything.
- [ ] Verify the whole program in a signed-in browser: build a model from onboarding, rate a role to completion, read the ladder and a flagged placement, export the appendix, and ask the assistant one question per new page.
- [ ] Tests: `bun run test` green including guard 5 (every assistant destination is a real route with the app's own label in every locale); report the docs:eval numbers in the task report.
- [ ] Commit: `fix(assistant): the assistant knows the model it serves`

---

## Self-review

The spec's §10.1 fas 6 has five bullets. Bullet 1 (corpus alignment, five locales, `docs:sync`, `docs:eval`) maps to tasks 1 to 4 and the eval step in task 7; bullet 2 (metodbilaga growth) shipped 2026-08-27 and is deliberately absent; bullet 3 (help-text sweep) is task 5; bullet 4 (one cross-locale QA pass retiring the native-review entries) is task 6; bullet 5 (assistant pass, tracker update, full browser verification) is task 7, except the tracker update, which is the controller's closing act and not a task. No placeholders; the verify-first steps are marked in tasks 1 and 7. Cross-task interfaces: task 2 moves content out of the page task 1 corrects, so task 1 lands first; task 5's glossary additions and task 3's profile-criterion definition must agree, and task 5 is written after task 3 for that reason; task 7 consumes the corpus tasks 1 to 5 leave and must run last.
