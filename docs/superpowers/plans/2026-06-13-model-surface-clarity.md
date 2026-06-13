# Model-surface clarity (bedömningsnivå rename + criterion-editor levels + importance label) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the model surface legible by renaming the displayed "assessment anchors" to "assessment level / bedömningsnivå", numbering the criterion-editor's six inputs as the 0-to-5 scale with endpoint cues, and labelling the read-mode importance value as "Importance N · X%", all while keeping the i18n key identifiers (`anchors`, `anchorLevel`, `anchorsLabel`, `anchorsBody`) and the Convex field name `criteria.anchors` unchanged.

**Architecture:** Values-only i18n string renames plus five new `dashboard.model.editor.level*`/`importance` keys mirrored across all five locales, a static (no-state-reveal) layout pass on `criterion-form.tsx`, an `Importance` prefix on the read-mode importance node in `model-editor.tsx`, and a one-step widening of the fixed importance slot in `criterion-item.tsx` so toggling edit mode never reflows. Documentation (two glossaries + PLAN-V1) records the UI term "bedömningsnivå" and notes that `nivå` here is the criterion 0-5 scale, distinct from the V2 individual-seniority `nivå` (ADR-0005).

**Tech Stack:** Next.js 16 + React + next-intl + `@workspace/ui` (shadcn) in a Turborepo/Bun monorepo. Tests are Vitest 4 (`bun run test`), with React component tests via `@testing-library/react` + `NextIntlClientProvider` and convex-dependent components mocked through `@/test/convex-mocks`. i18n parity is guarded by `packages/i18n/src/messages.test.ts`.

---

### Task 1: Rename the displayed anchor strings to "assessment level / bedömningsnivå" (values only, keys unchanged)

**Files:**
- Modify: `packages/i18n/messages/en.json` (lines 395-396 `editor.anchors`/`editor.anchorLevel`; lines 444-445 `help.anchorsLabel`/`help.anchorsBody`)
- Modify: `packages/i18n/messages/sv.json` (same four keys)
- Modify: `packages/i18n/messages/nb.json` (same four keys)
- Modify: `packages/i18n/messages/da.json` (same four keys)
- Modify: `packages/i18n/messages/fi.json` (same four keys)
- Test: `packages/i18n/src/messages.test.ts` (parity, no edit; it must stay green because only values change, not keys)

This task renames only string values. The keys `anchors`, `anchorLevel`, `anchorsLabel`, `anchorsBody` keep their names (spec decision 3). No `criterion-item.tsx`/`criterion-form.tsx` code changes here: those components already read `tEditor("anchors")` and `tEditor("anchorLevel", { level })`, so the new values flow through automatically.

- [ ] Run the parity test first to confirm a green baseline before touching anything:
  ```
  bun run --cwd packages/i18n test
  ```
  Expected output includes:
  ```
   ✓ src/messages.test.ts (5 tests) ...
   Test Files  1 passed (1)
  ```

- [ ] Edit `packages/i18n/messages/en.json` line 395 `editor.anchors`. Change the value from `"Assessment anchors (0 to 5)"` to:
  ```
        "anchors": "Assessment levels (0 to 5)",
  ```

- [ ] Edit `packages/i18n/messages/en.json` line 396 `editor.anchorLevel`. Change the value from `"Anchor {level}"` to:
  ```
        "anchorLevel": "Level {level}",
  ```

- [ ] Edit `packages/i18n/messages/en.json` line 444 `help.anchorsLabel`. Change from `"How do assessment anchors work?"` to:
  ```
        "anchorsLabel": "How do assessment levels work?",
  ```

- [ ] Edit `packages/i18n/messages/en.json` line 445 `help.anchorsBody`. Replace the whole value with the rewritten body that names the six levels plainly and keeps the anchor-role clarification:
  ```
        "anchorsBody": "These are the six levels, 0 to 5, for this criterion. Each one describes what a role looks like at that level: write them concrete and role-focused, clearly increasing from 0 (not present) to 5 (the strongest reasonable expression), so two assessors reading the same job profile land on the same rating. Assessment levels are texts on a single criterion; an anchor role is a whole reference role used to compare assessments.",
  ```

- [ ] Edit `packages/i18n/messages/sv.json` line `editor.anchors`. Change from `"Bedömningsankare (0 till 5)"` to:
  ```
        "anchors": "Bedömningsnivåer (0 till 5)",
  ```

- [ ] Edit `packages/i18n/messages/sv.json` `editor.anchorLevel`. Change from `"Ankare {level}"` to:
  ```
        "anchorLevel": "Nivå {level}",
  ```

- [ ] Edit `packages/i18n/messages/sv.json` `help.anchorsLabel`. Change from `"Hur fungerar bedömningsankare?"` to:
  ```
        "anchorsLabel": "Hur fungerar bedömningsnivåer?",
  ```

- [ ] Edit `packages/i18n/messages/sv.json` `help.anchorsBody`. Replace the whole value with:
  ```
        "anchorsBody": "Det här är de sex nivåerna, 0 till 5, för det här kriteriet. Varje nivå beskriver hur en roll ser ut på den nivån: skriv dem konkreta och rollfokuserade, tydligt stigande från 0 (förekommer inte) till 5 (det starkaste rimliga uttrycket), så att två bedömare som läser samma jobbprofil landar i samma betyg. Bedömningsnivåer är texter på ett enskilt kriterium; en ankarroll är en hel referensroll som används för att jämföra bedömningar.",
  ```

- [ ] Edit `packages/i18n/messages/nb.json` `editor.anchors`. Change from `"Vurderingsankere (0 til 5)"` to:
  ```
        "anchors": "Vurderingsnivåer (0 til 5)",
  ```

- [ ] Edit `packages/i18n/messages/nb.json` `editor.anchorLevel`. Change from `"Anker {level}"` to:
  ```
        "anchorLevel": "Nivå {level}",
  ```

- [ ] Edit `packages/i18n/messages/nb.json` `help.anchorsLabel`. Change from `"Hvordan fungerer vurderingsankere?"` to:
  ```
        "anchorsLabel": "Hvordan fungerer vurderingsnivåer?",
  ```

- [ ] Edit `packages/i18n/messages/nb.json` `help.anchorsBody`. Replace the whole value with:
  ```
        "anchorsBody": "Dette er de seks nivåene, 0 til 5, for dette kriteriet. Hvert nivå beskriver hvordan en rolle ser ut på det nivået: skriv dem konkrete og rollefokuserte, tydelig stigende fra 0 (forekommer ikke) til 5 (det sterkeste rimelige uttrykket), slik at to vurderere som leser samme jobbprofil lander på samme karakter. Vurderingsnivåer er tekster på ett enkelt kriterium; en ankerrolle er en hel referanserolle som brukes til å sammenligne vurderinger.",
  ```

- [ ] Edit `packages/i18n/messages/da.json` `editor.anchors`. Change from `"Bedømmelsesankre (0 til 5)"` to:
  ```
        "anchors": "Bedømmelsesniveauer (0 til 5)",
  ```

- [ ] Edit `packages/i18n/messages/da.json` `editor.anchorLevel`. Change from `"Anker {level}"` to:
  ```
        "anchorLevel": "Niveau {level}",
  ```

- [ ] Edit `packages/i18n/messages/da.json` `help.anchorsLabel`. Change from `"Hvordan fungerer bedømmelsesankre?"` to:
  ```
        "anchorsLabel": "Hvordan fungerer bedømmelsesniveauer?",
  ```

- [ ] Edit `packages/i18n/messages/da.json` `help.anchorsBody`. Replace the whole value with:
  ```
        "anchorsBody": "Dette er de seks niveauer, 0 til 5, for netop dette kriterium. Hvert niveau beskriver, hvordan en rolle ser ud på det niveau: skriv dem konkrete og rollefokuserede, tydeligt stigende fra 0 (forekommer ikke) til 5 (det stærkeste rimelige udtryk), så to bedømmere, der læser samme jobprofil, lander på samme karakter. Bedømmelsesniveauer er tekster på et enkelt kriterium; en ankerrolle er en hel referencerolle, der bruges til at sammenligne vurderinger.",
  ```

- [ ] Edit `packages/i18n/messages/fi.json` `editor.anchors`. Change from `"Arviointiankkurit (0 - 5)"` to (Finnish flagged for native review):
  ```
        "anchors": "Arviointitasot (0-5)",
  ```

- [ ] Edit `packages/i18n/messages/fi.json` `editor.anchorLevel`. Change from `"Ankkuri {level}"` to:
  ```
        "anchorLevel": "Taso {level}",
  ```

- [ ] Edit `packages/i18n/messages/fi.json` `help.anchorsLabel`. Change from `"Miten arviointiankkurit toimivat?"` to:
  ```
        "anchorsLabel": "Miten arviointitasot toimivat?",
  ```

- [ ] Edit `packages/i18n/messages/fi.json` `help.anchorsBody`. Replace the whole value with (Finnish flagged for native review):
  ```
        "anchorsBody": "Nämä ovat tämän kriteerin kuusi tasoa, 0:sta 5:een. Jokainen taso kuvaa, miltä rooli näyttää sillä tasolla: kirjoita niistä konkreettisia ja rooliin keskittyviä, selvästi nousevia arvosta 0 (ei esiinny) arvoon 5 (vahvin kohtuullinen ilmentymä), jotta kaksi arvioijaa, jotka lukevat saman tehtäväprofiilin, päätyvät samaan arvosanaan. Arviointitasot ovat yhden kriteerin tekstejä; ankkurirooli on kokonainen vertailurooli, jota käytetään arviointien vertaamiseen.",
  ```

- [ ] Verify all five files are valid JSON and the key sets still match (no keys added or removed in this task):
  ```
  for f in en sv nb da fi; do python3 -c "import json;json.load(open('packages/i18n/messages/$f.json'))" && echo "$f OK"; done
  ```
  Expected output:
  ```
  en OK
  sv OK
  nb OK
  da OK
  fi OK
  ```

- [ ] Run the existing model component tests that assert against these strings. `criterion-item.test.tsx` reads `messages.dashboard.model.editor.anchors` by reference (not a literal), so it stays green automatically; `criterion-form.test.tsx` locates the anchor inputs with `getByLabelText(editor.anchorLevel.replace("{level}", ...))`, also by reference, so the rename does not break it. Run the dashboard suite to confirm:
  ```
  bun run --cwd apps/dashboard test
  ```
  Expected: all test files pass, including `criterion-item.test.tsx` and `criterion-form.test.tsx`.

- [ ] Run the i18n parity test to confirm it is still green (values changed, key sets unchanged):
  ```
  bun run --cwd packages/i18n test
  ```
  Expected:
  ```
   ✓ src/messages.test.ts (5 tests) ...
   Test Files  1 passed (1)
  ```

- [ ] Commit:
  ```
  git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
  git commit -m "refactor(model): rename displayed anchor strings to assessment level / bedömningsnivå

Values-only rename of dashboard.model.editor.anchors/anchorLevel and
dashboard.help.anchorsLabel/anchorsBody across all five locales. Key
identifiers and the Convex field name criteria.anchors are unchanged
(spec decision 3). Help body now names the six 0-to-5 levels plainly and
keeps the anchor-role clarification. nb/da/fi mirrored; fi flagged for
native review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 2: Add the five new criterion-editor level keys to all five locales

**Files:**
- Modify: `packages/i18n/messages/en.json` (insert five keys into the `dashboard.model.editor` block, after `anchorLevel` at line 396)
- Modify: `packages/i18n/messages/sv.json` (same five keys, same position)
- Modify: `packages/i18n/messages/nb.json` (same five keys, same position)
- Modify: `packages/i18n/messages/da.json` (same five keys, same position)
- Modify: `packages/i18n/messages/fi.json` (same five keys, same position)
- Test: `packages/i18n/src/messages.test.ts` (parity test will FAIL after the en edit until the other four mirror it)

The new keys use the `level*` stem (spec: `levelsIntro`, `levelEndpointLowest`, `levelEndpointHighest`, `levelPlaceholderLowest`, `levelPlaceholderHighest`). They are consumed by `criterion-form.tsx` in Task 3.

- [ ] Insert the five keys into `packages/i18n/messages/en.json` immediately after the `"anchorLevel": "Level {level}",` line (line 396) inside the `editor` block. The block then reads:
  ```
        "anchorLevel": "Level {level}",
        "levelsIntro": "Describe what a role looks like at each level, from 0 (lowest) to 5 (highest).",
        "levelEndpointLowest": "lowest",
        "levelEndpointHighest": "highest",
        "levelPlaceholderLowest": "e.g. not present / not required",
        "levelPlaceholderHighest": "e.g. the strongest reasonable expression",
        "addCta": "Add criterion",
  ```

- [ ] Run the parity test to prove it FAILS now (en has five keys the others lack):
  ```
  bun run --cwd packages/i18n test
  ```
  Expected: 4 failing tests (da/fi/nb/sv), each like:
  ```
   FAIL  src/messages.test.ts > message file parity > sv.json has exactly the keys of en.json
   AssertionError: expected [ … ] to deeply equal [ … ]
  ```
  (the diff lists the five missing `dashboard.model.editor.level*` keys)

- [ ] Insert the same five keys into `packages/i18n/messages/sv.json` after its `"anchorLevel": "Nivå {level}",` line:
  ```
        "anchorLevel": "Nivå {level}",
        "levelsIntro": "Beskriv hur en roll ser ut på varje nivå, från 0 (lägst) till 5 (högst).",
        "levelEndpointLowest": "lägst",
        "levelEndpointHighest": "högst",
        "levelPlaceholderLowest": "t.ex. förekommer inte / krävs inte",
        "levelPlaceholderHighest": "t.ex. det starkaste rimliga uttrycket",
        "addCta": "Lägg till kriterium",
  ```
  (Match `addCta`'s existing Swedish value; only the five level keys are inserted before it.)

- [ ] Insert the same five keys into `packages/i18n/messages/nb.json` after its `"anchorLevel": "Nivå {level}",` line:
  ```
        "anchorLevel": "Nivå {level}",
        "levelsIntro": "Beskriv hvordan en rolle ser ut på hvert nivå, fra 0 (lavest) til 5 (høyest).",
        "levelEndpointLowest": "lavest",
        "levelEndpointHighest": "høyest",
        "levelPlaceholderLowest": "f.eks. forekommer ikke / kreves ikke",
        "levelPlaceholderHighest": "f.eks. det sterkeste rimelige uttrykket",
  ```
  (Keep the existing `addCta` line that follows it unchanged.)

- [ ] Insert the same five keys into `packages/i18n/messages/da.json` after its `"anchorLevel": "Niveau {level}",` line:
  ```
        "anchorLevel": "Niveau {level}",
        "levelsIntro": "Beskriv, hvordan en rolle ser ud på hvert niveau, fra 0 (lavest) til 5 (højest).",
        "levelEndpointLowest": "lavest",
        "levelEndpointHighest": "højest",
        "levelPlaceholderLowest": "f.eks. forekommer ikke / kræves ikke",
        "levelPlaceholderHighest": "f.eks. det stærkeste rimelige udtryk",
  ```
  (Keep the existing `addCta` line that follows it unchanged.)

- [ ] Insert the same five keys into `packages/i18n/messages/fi.json` after its `"anchorLevel": "Taso {level}",` line (Finnish flagged for native review):
  ```
        "anchorLevel": "Taso {level}",
        "levelsIntro": "Kuvaa, miltä rooli näyttää kullakin tasolla, 0:sta (matalin) 5:een (korkein).",
        "levelEndpointLowest": "matalin",
        "levelEndpointHighest": "korkein",
        "levelPlaceholderLowest": "esim. ei esiinny / ei vaadita",
        "levelPlaceholderHighest": "esim. vahvin kohtuullinen ilmentymä",
  ```
  (Keep the existing `addCta` line that follows it unchanged.)

- [ ] Verify all five files are valid JSON:
  ```
  for f in en sv nb da fi; do python3 -c "import json;json.load(open('packages/i18n/messages/$f.json'))" && echo "$f OK"; done
  ```
  Expected: `en OK` / `sv OK` / `nb OK` / `da OK` / `fi OK`.

- [ ] Run the parity test to prove it now PASSES (all five carry the same key set):
  ```
  bun run --cwd packages/i18n test
  ```
  Expected:
  ```
   ✓ src/messages.test.ts (5 tests) ...
   Test Files  1 passed (1)
  ```

- [ ] Commit:
  ```
  git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
  git commit -m "feat(i18n): add criterion-editor level keys (levelsIntro, endpoints, placeholders)

Five new dashboard.model.editor.level* keys for the criterion-form
clarity pass, mirrored across all five locales so the parity test stays
green. nb/da/fi mirrored; fi flagged for native review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 3: Criterion-form clarity pass (helper line, level badges, endpoint tags, endpoint placeholders)

**Files:**
- Modify: `apps/dashboard/components/model/criterion-form.tsx` (the `<fieldset>` block, lines 106-137)
- Test: `apps/dashboard/components/model/criterion-form.test.tsx` (add a new `describe` block for the clarity pass)

The layout stays static (no state-triggered reveal), satisfying the minimize-layout-shift rule. The `anchorLevel` label now renders alongside a fixed-width numeric badge and the endpoint tag, so the visible `<Label>` text is no longer just "Level N". The existing tests at `criterion-form.test.tsx` lines 63-66 and 92-97 locate the anchor inputs with `screen.getByLabelText(editor.anchorLevel.replace("{level}", "0"/"5"))`, and `getByLabelText` defaults to `exact: true`, matching the input's FULL accessible name. If the badge `<span>{index}</span>` and the endpoint `<span>` sit inside the `<Label>`, the input's accessible name becomes the concatenation (e.g. "0Level 0lowest") and those two existing tests break. To keep them passing while still showing the badge and tag inside the label, the `<Input>` is given an explicit `aria-label={tEditor("anchorLevel", { level: index })}`: an element's own `aria-label` overrides any associated `<label>` text in the accessible-name computation, so the input's accessible name is exactly "Level N" regardless of the visible label content, and `getByLabelText("Level 0")`/`("Level 5")` still match.

- [ ] Write the failing test. Append this `describe` block to the END of `apps/dashboard/components/model/criterion-form.test.tsx` (after the existing closing `})` of the `describe("CriterionForm", ...)` block, before EOF). It reuses the file's existing `editor` constant (`messages.dashboard.model.editor`) and `renderForm` helper, and the already-imported `cleanup`, `render`, `screen`, `afterEach`, `describe`, `expect`, `it`:
  ```tsx
  describe("CriterionForm level clarity pass", () => {
    afterEach(() => {
      cleanup()
    })

    it("renders the levels helper line under the anchors legend", () => {
      renderForm()
      expect(screen.getByText(editor.levelsIntro)).toBeDefined()
    })

    it("renders all six level labels from 0 to 5", () => {
      renderForm()
      for (let level = 0; level <= 5; level++) {
        expect(
          screen.getByText(editor.anchorLevel.replace("{level}", String(level)))
        ).toBeDefined()
      }
    })

    it("tags the lowest and highest rows", () => {
      renderForm()
      expect(screen.getByText(editor.levelEndpointLowest)).toBeDefined()
      expect(screen.getByText(editor.levelEndpointHighest)).toBeDefined()
    })

    it("gives the 0 and 5 inputs example placeholders", () => {
      renderForm()
      expect(
        screen.getByPlaceholderText(editor.levelPlaceholderLowest)
      ).toBeDefined()
      expect(
        screen.getByPlaceholderText(editor.levelPlaceholderHighest)
      ).toBeDefined()
    })

    it("keeps each anchor input's accessible name exactly the level label", () => {
      renderForm()
      // getByLabelText defaults to exact=true and matches the full accessible
      // name; the explicit aria-label on the input keeps it "Level 0"/"Level 5"
      // even though the visible Label also contains the badge and endpoint tag.
      expect(
        screen.getByLabelText(editor.anchorLevel.replace("{level}", "0"))
      ).toBeDefined()
      expect(
        screen.getByLabelText(editor.anchorLevel.replace("{level}", "5"))
      ).toBeDefined()
    })
  })
  ```

- [ ] Run the test to verify it FAILS (the helper line, tags, and placeholders do not exist yet):
  ```
  bun run --cwd apps/dashboard test criterion-form
  ```
  Expected: the new `levelsIntro`/endpoint/placeholder tests fail with `Unable to find an element with the text: Describe what a role looks like at each level...` (and the placeholder/tag equivalents). The two existing tests (lines 63-66, 92-97) and the new accessible-name test still pass against the current code, because the current `<Label>` contains only the level text.

- [ ] Write the minimal implementation. In `apps/dashboard/components/model/criterion-form.tsx`, replace the entire `<fieldset> … </fieldset>` block (lines 106-137) with this version. It adds the helper line under the legend, a fixed-width level badge per row, an endpoint tag on rows 0 and 5, and example placeholders on the 0 and 5 inputs. Each `<Input>` carries an explicit `aria-label` of the level label so its accessible name is exactly "Level N" regardless of the badge/tag inside the `<Label>`. All copy comes from `tEditor`:
  ```tsx
        <fieldset className="space-y-2">
          <legend className="font-medium text-sm">
            <span className="flex items-center gap-1.5">
              {tEditor("anchors")}
              <HelpMorphButton label={tHelp("anchorsLabel")}>
                {tHelp("anchorsBody")}
              </HelpMorphButton>
            </span>
          </legend>
          {/* Static helper line: states the 0-to-5 direction in plain language
              so the six inputs read as the levels of the scale, not as a list
              of names. Always present (no state-triggered reveal), so the
              layout never shifts. */}
          <p className="text-muted-foreground text-sm">
            {tEditor("levelsIntro")}
          </p>
          {anchors.map((anchor, index) => {
            const isLowest = index === 0
            const isHighest = index === anchors.length - 1
            const levelLabel = tEditor("anchorLevel", { level: index })
            return (
              <div
                // The anchor list is fixed-length and positional, so the index
                // is a stable key here.
                // biome-ignore lint/suspicious/noArrayIndexKey: positional fixed-length list
                key={index}
                className="space-y-1"
              >
                <Label
                  htmlFor={`criterion-anchor-${index}`}
                  className="flex items-center gap-2"
                >
                  {/* Fixed-width numeric badge so the number reads as scale
                      position, not part of the label text. */}
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs tabular-nums">
                    {index}
                  </span>
                  {levelLabel}
                  {isLowest && (
                    <span className="text-muted-foreground text-xs">
                      {tEditor("levelEndpointLowest")}
                    </span>
                  )}
                  {isHighest && (
                    <span className="text-muted-foreground text-xs">
                      {tEditor("levelEndpointHighest")}
                    </span>
                  )}
                </Label>
                <Input
                  id={`criterion-anchor-${index}`}
                  // Explicit accessible name so the input is "Level N" even
                  // though the visible Label also holds the badge and endpoint
                  // tag; aria-label overrides the associated label text in the
                  // accessible-name computation. Keeps getByLabelText("Level N")
                  // working.
                  aria-label={levelLabel}
                  value={anchor}
                  placeholder={
                    isLowest
                      ? tEditor("levelPlaceholderLowest")
                      : isHighest
                        ? tEditor("levelPlaceholderHighest")
                        : undefined
                  }
                  onChange={(event) => {
                    const next = [...anchors]
                    next[index] = event.target.value
                    setAnchors(next)
                  }}
                />
              </div>
            )
          })}
        </fieldset>
  ```

- [ ] Run the test to verify it PASSES, and that the ORIGINAL four `CriterionForm` tests still pass. Run the whole file (not just the new block) so both suites execute:
  ```
  bun run --cwd apps/dashboard test criterion-form
  ```
  Expected: both `describe` blocks pass. The original four `CriterionForm` tests pass because each anchor `<Input>` now has `aria-label="Level 0"`/`"Level 5"`, so `getByLabelText(editor.anchorLevel.replace("{level}", "0"/"5"))` (exact match on the accessible name) still resolves to the right input even though the visible `<Label>` now also contains the badge and endpoint tag; the five new clarity-pass tests pass because the helper line, six level labels, endpoint tags, endpoint placeholders, and the exact accessible names are all present.

- [ ] Run Biome on the changed file to confirm formatting is clean before committing (the pre-commit hook runs Biome on staged files):
  ```
  bunx biome check apps/dashboard/components/model/criterion-form.tsx
  ```
  Expected: `Checked 1 file ... No fixes applied.` (or a clean check with no errors).

- [ ] Commit:
  ```
  git add apps/dashboard/components/model/criterion-form.tsx apps/dashboard/components/model/criterion-form.test.tsx
  git commit -m "feat(model): make criterion editor read as the 0-to-5 level scale

Static clarity pass on the criterion form: a muted helper line under the
levels legend, a fixed-width level-number badge per row, lowest/highest
tags on rows 0 and 5, and example placeholders on the 0 and 5 inputs. No
state-triggered reveal, so the layout never shifts. Each anchor input
carries an explicit aria-label of its level so its accessible name stays
exactly the level label even with the badge and tag inside the visible
label, keeping getByLabelText lookups working. Tests assert the helper
line, the six level labels, the endpoint tags, the endpoint placeholders,
and the exact per-input accessible names.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 4: Add the `importance` label key to all five locales

**Files:**
- Modify: `packages/i18n/messages/en.json` (insert `importance` into `dashboard.model.editor`, after `setWeightPoints` at line 394)
- Modify: `packages/i18n/messages/sv.json` (same key, same position)
- Modify: `packages/i18n/messages/nb.json` (same key, same position)
- Modify: `packages/i18n/messages/da.json` (same key, same position)
- Modify: `packages/i18n/messages/fi.json` (same key, same position)
- Test: `packages/i18n/src/messages.test.ts` (parity test FAILS after the en edit until the other four mirror it)

This is the surface label only. The documented domain term "weight points / viktpoäng" (ADR-0004) is unchanged; "Importance / Viktnivå" is a display prefix.

- [ ] Insert the `importance` key into `packages/i18n/messages/en.json` immediately after the `"setWeightPoints": "Weight points for {name}",` line (line 394), so the `editor` block reads:
  ```
        "setWeightPoints": "Weight points for {name}",
        "importance": "Importance",
        "anchors": "Assessment levels (0 to 5)",
  ```

- [ ] Run the parity test to prove it FAILS:
  ```
  bun run --cwd packages/i18n test
  ```
  Expected: 4 failing tests (da/fi/nb/sv), each reporting the missing `dashboard.model.editor.importance` key.

- [ ] Insert `importance` into `packages/i18n/messages/sv.json` after its `setWeightPoints` line:
  ```
        "importance": "Viktnivå",
  ```

- [ ] Insert `importance` into `packages/i18n/messages/nb.json` after its `setWeightPoints` line:
  ```
        "importance": "Vektnivå",
  ```

- [ ] Insert `importance` into `packages/i18n/messages/da.json` after its `setWeightPoints` line:
  ```
        "importance": "Vægtniveau",
  ```

- [ ] Insert `importance` into `packages/i18n/messages/fi.json` after its `setWeightPoints` line (Finnish flagged for native review):
  ```
        "importance": "Painotaso",
  ```

- [ ] Verify all five files are valid JSON:
  ```
  for f in en sv nb da fi; do python3 -c "import json;json.load(open('packages/i18n/messages/$f.json'))" && echo "$f OK"; done
  ```
  Expected: `en OK` / `sv OK` / `nb OK` / `da OK` / `fi OK`.

- [ ] Run the parity test to prove it now PASSES:
  ```
  bun run --cwd packages/i18n test
  ```
  Expected:
  ```
   ✓ src/messages.test.ts (5 tests) ...
   Test Files  1 passed (1)
  ```

- [ ] Commit:
  ```
  git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
  git commit -m "feat(i18n): add dashboard.model.editor.importance surface label

Display prefix for the read-mode importance value (Importance / Viktnivå),
mirrored across all five locales. The documented domain term weight points
/ viktpoäng (ADR-0004) is unchanged. nb Vektnivå, da Vægtniveau; fi flagged
for native review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 5: Widen the importance slot so the longer read label cannot reflow on edit toggle

**Files:**
- Modify: `apps/dashboard/components/model/criterion-item.tsx` (line 156, the fixed importance slot)
- Test: `apps/dashboard/components/model/criterion-item.test.tsx` (no edit; existing tests must stay green)

The read label grows from "5 · 20%" to "Importance 5 · 20%". The slot is a fixed `w-44` (176px) that must hold both the read label (read mode) and the full 1-5 `ButtonGroup` (edit mode) without either mode reflowing the row when edit toggles. "Importance 5 · 20%" at the read label's `text-sm` does not fit comfortably in 176px, so widen the slot one step to `w-52` (208px). The `ButtonGroup` inside uses `className="w-full"` (model-editor.tsx line 269), so it expands to fill the wider slot automatically; the five buttons are `flex-1`, so they stay even.

- [ ] Edit `apps/dashboard/components/model/criterion-item.tsx` line 156. Change the slot width and update its explanatory comment. Replace:
  ```tsx
          <span className="flex h-9 w-44 shrink-0 items-center justify-end">
            {importanceNode}
          </span>
  ```
  with:
  ```tsx
          {/* Widened to w-52 so the read-mode label "Importance 5 · 20%" fits
              on one line without wrap; the edit-mode ButtonGroup is w-full so
              it still fills the slot. Identical outer box in both modes, so
              toggling edit shifts nothing. */}
          <span className="flex h-9 w-52 shrink-0 items-center justify-end">
            {importanceNode}
          </span>
  ```

- [ ] Run the existing criterion-item tests to confirm the width change is behaviorally inert (the slot still renders its `importanceNode`):
  ```
  bun run --cwd apps/dashboard test criterion-item
  ```
  Expected: all existing `criterion-item.test.tsx` tests pass (anchor scale section + row menu).

- [ ] Run Biome on the changed file:
  ```
  bunx biome check apps/dashboard/components/model/criterion-item.tsx
  ```
  Expected: clean check, no errors.

- [ ] Commit:
  ```
  git add apps/dashboard/components/model/criterion-item.tsx
  git commit -m "fix(model): widen importance slot to w-52 for the longer read label

The read-mode importance label gains an Importance prefix in the next
change. Widen the fixed slot from w-44 to w-52 so 'Importance 5 · 20%'
fits on one line and the edit-mode ButtonGroup (w-full) still fills the
slot, keeping the row reflow-free when edit toggles.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 6: Prefix the read-mode importance node in model-editor and test it at the render site

**Files:**
- Modify: `apps/dashboard/components/model/model-editor.tsx` (the read-mode `weightNode`, lines 291-299)
- Create: `apps/dashboard/components/model/model-editor.test.tsx` (no model-editor test exists yet; spec requires a focused test at the render site)
- Test: `apps/dashboard/components/model/model-editor.test.tsx`

The read-mode row currently renders the bare `{weightPoints} · {share}`. Prefix it with the `importance` label so it reads "Importance 5 · 20%". The model-editor depends on convex `useQuery`/`useMutation`, so the test mocks them through the existing `@/test/convex-mocks` helper (the same pattern `model-draft-panel.test.tsx` uses).

- [ ] Write the failing test. Create `apps/dashboard/components/model/model-editor.test.tsx` with the full content below. It mocks `convex/react` and the generated api via `@/test/convex-mocks`, feeds a one-criterion model through `onQuery`, returns `false` for the weight-review lock, and asserts the read-mode row shows the `Importance` label together with the points (`5`) and the share (`100.0%` for a single criterion at full weight, formatted by `formatShare`):
  ```tsx
  import { cleanup, render, screen } from "@testing-library/react"
  import { NextIntlClientProvider } from "next-intl"
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
  import messages from "@workspace/i18n/messages/en.json"

  import { mockMutation, onQuery } from "@/test/convex-mocks"

  // Register the mutations ModelEditor wires up so useMutation resolves.
  mockMutation("evaluationModel.criteria.rebalanceWeights")
  mockMutation("evaluationModel.criteria.removeCriterion")
  const useQueryMock = vi.fn()
  onQuery((ref, args) => useQueryMock(ref, args))

  vi.mock("convex/react", async () => {
    return (await import("@/test/convex-mocks")).convexReactModule
  })
  vi.mock("@workspace/backend/convex/_generated/api", async () => {
    return (await import("@/test/convex-mocks")).apiModule
  })

  import { ModelEditor } from "@/components/model/model-editor"

  const editor = messages.dashboard.model.editor

  // Minimal getModel payload: one criterion at the full weight budget, so the
  // derived share is 100.0% and the read-mode label is unambiguous.
  const MODEL = {
    criteria: [
      {
        criterionId: "c1",
        name: "Complexity",
        description: "How hard the problems are",
        helpText: "",
        weightPoints: 5,
        anchors: [
          { level: 0, text: "a0" },
          { level: 1, text: "a1" },
          { level: 2, text: "a2" },
          { level: 3, text: "a3" },
          { level: 4, text: "a4" },
          { level: 5, text: "a5" },
        ],
      },
    ],
  }

  function dispatch(ref: string) {
    if (ref === "evaluationModel.model.getModel") return MODEL
    if (ref === "ai.suggest.getWeightReviewLock") return false
    return undefined
  }

  function renderEditor() {
    return render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ModelEditor orgId="org-1" />
      </NextIntlClientProvider>
    )
  }

  describe("ModelEditor read-mode importance label", () => {
    beforeEach(() => {
      useQueryMock.mockReset()
      useQueryMock.mockImplementation((ref: string) => dispatch(ref))
    })
    afterEach(() => {
      cleanup()
    })

    it("prefixes the importance value with the Importance label", () => {
      renderEditor()
      // The label, the points, and the derived share all render in the row.
      expect(screen.getByText(editor.importance)).toBeDefined()
      expect(screen.getByText("5")).toBeDefined()
      expect(screen.getByText(/100[.,]0\s*%/)).toBeDefined()
    })
  })
  ```

- [ ] Run the test to verify it FAILS (the `Importance` label is not rendered yet):
  ```
  bun run --cwd apps/dashboard test model-editor
  ```
  Expected: the test fails on `getByText(editor.importance)` with `Unable to find an element with the text: Importance`.

  If the test instead errors with `mockMutation`/`onQuery`/`convexReactModule`/`apiModule` not being exported from `@/test/convex-mocks`, stop and read `apps/dashboard/test/convex-mocks.ts` plus `apps/dashboard/components/model/model-draft-panel.test.tsx` to match the helper's ACTUAL export names and `vi.mock` factory shape, then adjust the imports and `vi.mock` factories above to those exact names before re-running. The assertion to keep is `getByText(editor.importance)`.

- [ ] Write the minimal implementation. In `apps/dashboard/components/model/model-editor.tsx`, replace the read-mode branch of `weightNode` (the `: (` … `)` else-branch, lines 291-299) so the label prefixes the value. Replace:
  ```tsx
              ) : (
                <span className="text-sm tabular-nums">
                  {criterion.weightPoints}
                  <span className="text-muted-foreground">
                    {" · "}
                    {formatShare(criterion.weightPoints, storedTotal, locale)}
                  </span>
                </span>
              )
  ```
  with:
  ```tsx
              ) : (
                // Read-mode importance: the surface label prefixes the bare
                // points + derived share so the value reads "Importance 5 ·
                // 20%". "Importance / Viktnivå" is only the display label; the
                // documented domain term is weight points (ADR-0004). The
                // single weight-points help lives on the budget meter, so no
                // second popover is added here.
                <span className="text-sm">
                  <span className="text-muted-foreground">
                    {tEditor("importance")}{" "}
                  </span>
                  <span className="tabular-nums">{criterion.weightPoints}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {" · "}
                    {formatShare(criterion.weightPoints, storedTotal, locale)}
                  </span>
                </span>
              )
  ```
  (`tEditor` is already defined at line 64; `formatShare` and `locale` are already imported/in scope. No new imports.)

- [ ] Run the test to verify it PASSES:
  ```
  bun run --cwd apps/dashboard test model-editor
  ```
  Expected: the `ModelEditor read-mode importance label` test passes.

- [ ] Run the full dashboard suite to confirm nothing regressed (criterion-item, criterion-form, model-draft-panel all still pass):
  ```
  bun run --cwd apps/dashboard test
  ```
  Expected: all test files pass.

- [ ] Run Biome on the changed/new files:
  ```
  bunx biome check apps/dashboard/components/model/model-editor.tsx apps/dashboard/components/model/model-editor.test.tsx
  ```
  Expected: clean check, no errors.

- [ ] Commit:
  ```
  git add apps/dashboard/components/model/model-editor.tsx apps/dashboard/components/model/model-editor.test.tsx
  git commit -m "feat(model): label the read-mode importance value (Importance 5 · 20%)

Prefix the read-mode criterion row's importance node with the Importance
surface label so it reads 'Importance 5 · 20%' (SV 'Viktnivå 5 · 20%').
The label is display only; the documented domain term weight points
(ADR-0004) is unchanged, and the single weight-points help stays on the
budget meter (no second popover). Adds a focused model-editor render test
mocking convex via @/test/convex-mocks.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 7: Record the UI term "bedömningsnivå" in the glossaries and PLAN-V1

**Files:**
- Modify: `docs/contexts/assessment/CONTEXT.md` (the "Ankare vs Ankarroll" flagged-ambiguity bullet, line 76; the anchor-role definition note, line 37)
- Modify: `docs/contexts/evaluation-model/CONTEXT.md` (the "Ankare" definition, lines 29-31)
- Modify: `docs/PLAN-V1.md` (the §6 status note that records the UI term, line 98)
- Test: none (Swedish domain documents are content, not code; no test asserts their text)

These are Swedish domain documents (per CLAUDE.md they keep Swedish content). Record that the UI term is now "bedömningsnivå" (replacing the earlier "bedömningsankare") and add the one-line note that `nivå` here is the criterion's 0-to-5 scale, distinct from the V2 individual-seniority `nivå` (ADR-0005). The canonical domain term `ankare` (and the code field `criteria.anchors`) is unchanged. Do not use em dashes; use hyphenated ranges (0-5) or parentheses.

- [ ] Edit `docs/contexts/evaluation-model/CONTEXT.md` lines 29-31, the "Ankare" definition. Replace:
  ```
  **Ankare** *(kod: Anchor)*:
  Texten som beskriver vad varje poäng 0–5 betyder för ett kriterium (t.ex. Autonomi 1 = "följer instruktioner", 5 = "sätter riktning för andra funktioner"). Konfigurerbar per kriterium.
  _Undvik_: Ankarroll (en annan sak — se Värdering), Skalbeskrivning
  ```
  with:
  ```
  **Ankare** *(kod: Anchor)*:
  Texten som beskriver vad varje poäng 0–5 betyder för ett kriterium (t.ex. Autonomi 1 = "följer instruktioner", 5 = "sätter riktning för andra funktioner"). Konfigurerbar per kriterium. Kanonisk term i tal och kod är **ankare** (fältet `criteria.anchors`); i UI heter kriteriets texter "bedömningsnivå" (de sex nivåerna 0 till 5), så att numreringen läses som skalans position. Obs: detta `nivå` är kriteriets 0–5-skala och är INTE samma som individens senioritetsnivå inom ett track (V2-term, ADR-0005).
  _Undvik_: Ankarroll (en annan sak, se Värdering), Skalbeskrivning
  ```

- [ ] Edit `docs/contexts/assessment/CONTEXT.md` line 76, the "Ankare vs Ankarroll" bullet. Replace:
  ```
  - **Ankare vs Ankarroll**: ett **ankare** är ett kriteriums 0–5-text (Värderingsmodell); en **ankarroll** är en referensroll för kalibrering. Samma ord, olika saker; säg alltid "ankarroll" explicit. I UI heter kriteriets texter "bedömningsankare" just för att undvika kollisionen.
  ```
  with:
  ```
  - **Ankare vs Ankarroll**: ett **ankare** är ett kriteriums 0–5-text (Värderingsmodell); en **ankarroll** är en referensroll för kalibrering. Samma ord, olika saker; säg alltid "ankarroll" explicit. I UI heter kriteriets texter sedan 2026-06-13 "bedömningsnivå" (de sex nivåerna 0 till 5; tidigare "bedömningsankare") just för att undvika kollisionen. Detta `nivå` är kriteriets 0–5-skala, inte individens senioritetsnivå inom ett track (V2, ADR-0005). Kanonisk term i kod är fortfarande `ankare` (fältet `criteria.anchors`).
  ```

- [ ] Edit `docs/contexts/assessment/CONTEXT.md` line 37, the anchor-role definition's closing clarification. Replace the trailing sentence:
  ```
  INTE samma som ett **ankare** (ett kriteriums 0–5-text; i UI "bedömningsankare").
  ```
  with:
  ```
  INTE samma som ett **ankare** (ett kriteriums 0–5-text; i UI "bedömningsnivå").
  ```

- [ ] Edit `docs/PLAN-V1.md` line 98, the §6 status note. Replace the sentence:
  ```
  Kriteriets ankartexter heter nu "bedömningsankare" i UI.
  ```
  with:
  ```
  Kriteriets ankartexter heter "bedömningsnivå" i UI (de sex nivåerna 0 till 5; sedan 2026-06-13, tidigare "bedömningsankare"); `nivå` här är kriteriets 0–5-skala, skild från V2:s individuella senioritetsnivå (ADR-0005). Kanonisk kodterm är fortsatt `ankare` (`criteria.anchors`).
  ```

- [ ] Verify the four doc edits landed and contain the new term in all three files (existing en dashes "0–5" are pre-existing Swedish range notation in these files and are kept; the rule bans the spaced em dash " — " in text we write, which none of the inserts use):
  ```
  grep -n "bedömningsnivå" docs/contexts/assessment/CONTEXT.md docs/contexts/evaluation-model/CONTEXT.md docs/PLAN-V1.md
  ```
  Expected: matches in all three files (assessment CONTEXT lines ~37 and ~76, evaluation-model CONTEXT line ~30, PLAN-V1 line ~98).

- [ ] Commit:
  ```
  git add docs/contexts/assessment/CONTEXT.md docs/contexts/evaluation-model/CONTEXT.md docs/PLAN-V1.md
  git commit -m "docs(model): record the UI term bedömningsnivå and the nivå distinction

The criterion's 0-to-5 anchor texts are shown as 'bedömningsnivå' in the
UI (the six levels 0 to 5), replacing the earlier 'bedömningsankare'. Note
in both glossaries and PLAN-V1 that this nivå is the criterion's 0-5 scale,
distinct from the V2 individual-seniority nivå (ADR-0005). The canonical
code term ankare (criteria.anchors) is unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 8: Full verification of the unit

**Files:** none (verification only)

- [ ] Run the full test suite (cache-backed turbo, the same gate the pre-commit hook runs) to confirm every package passes, including the i18n parity test and the dashboard component tests:
  ```
  bun run test
  ```
  Expected: all packages report passing; `packages/i18n` parity is green and `apps/dashboard` (criterion-form, criterion-item, model-editor) is green.

- [ ] Run the repo typecheck (the second of the three pre-commit gates) to confirm the new `tEditor("importance")`, `tEditor("levelsIntro")`, and the other `level*` keys are recognized by the generated `Messages` type:
  ```
  bun run typecheck
  ```
  Expected: no type errors. (If this command name differs, use `bunx turbo run typecheck`.)

- [ ] Confirm the four renamed/new i18n areas are present and consistent across all five locales:
  ```
  for f in en sv nb da fi; do
    echo "== $f =="
    python3 -c "import json;d=json.load(open('packages/i18n/messages/$f.json'));e=d['dashboard']['model']['editor'];print('anchors:',e['anchors']);print('anchorLevel:',e['anchorLevel']);print('importance:',e['importance']);print('levelsIntro:',e['levelsIntro'])"
  done
  ```
  Expected: each locale prints its translated `anchors` (Assessment levels / Bedömningsnivåer / Vurderingsnivåer / Bedømmelsesniveauer / Arviointitasot), `anchorLevel` with `{level}`, `importance` (Importance / Viktnivå / Vektnivå / Vægtniveau / Painotaso), and `levelsIntro`.

---

## Done when

- [ ] `dashboard.model.editor.anchors` reads "Assessment levels (0 to 5)" / "Bedömningsnivåer (0 till 5)" and `anchorLevel` reads "Level {level}" / "Nivå {level}" in all five locales, with the key identifiers `anchors`/`anchorLevel`/`anchorsLabel`/`anchorsBody` and the field name `criteria.anchors` unchanged.
- [ ] `dashboard.help.anchorsLabel`/`anchorsBody` are retitled and rewritten to name "the six levels, 0 to 5, for this criterion" and keep the anchor-role clarification, in all five locales.
- [ ] The criterion form shows the muted helper line, a level-number badge per row, "lowest"/"highest" tags on rows 0 and 5, and example placeholders on the 0 and 5 inputs, all static (no state-triggered reveal); each anchor input keeps its accessible name exactly the level label via `aria-label`, so the two existing `getByLabelText` tests stay green, and `criterion-form.test.tsx` asserts the helper line, labels, tags, placeholders, and exact accessible names.
- [ ] The model-editor read-mode row renders "Importance 5 · 20%" (SV "Viktnivå 5 · 20%"), the single existing weight-points help stays on the budget meter (no second popover), and `model-editor.test.tsx` asserts the label renders with points and share.
- [ ] The importance slot is widened to `w-52` so the longer read label fits without wrap and the edit-mode `ButtonGroup` still fills the slot, keeping the row reflow-free when edit toggles.
- [ ] All five new keys (`levelsIntro`, `levelEndpointLowest`, `levelEndpointHighest`, `levelPlaceholderLowest`, `levelPlaceholderHighest`) plus `importance` exist in every locale and the i18n parity test is green.
- [ ] Both glossaries and PLAN-V1 record the UI term "bedömningsnivå" and the note that `nivå` here is the criterion 0-5 scale, distinct from the V2 individual-seniority `nivå` (ADR-0005).
- [ ] `bun run test` and `bun run typecheck` both pass.
