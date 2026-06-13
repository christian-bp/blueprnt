# Opt-in "Score your roles" onboarding step + dashboard continue-scoring affordance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in final onboarding step that lets the user score their starter roles inline (profile capture, then the blind rating stepper, then the band reveal) with a save-and-exit escape on every path, plus a dashboard card that resumes scoring later.

**Architecture:** This is Unit 3 of the approved spec and depends on Unit 1 having merged (a role profile is now just `purpose` + `responsibilities`). The structural change rewires onboarding completion: `families-step` stops completing onboarding and instead advances to a new `score` step; `getOnboardingStatus` gains `hasRoles` so `families.isComplete` becomes server-derived and the wizard resumes correctly on reload; `completeOnboarding` (unchanged signature) now fires from the score step on every exit path. The score step reuses `RatingStepper`, `RatingResult`, and `RoleAiPanel` unchanged. The dashboard reads role completion counts from the existing `assessment.results.getResults` query (no new backend query).

**Tech Stack:** Convex backend (`packages/backend`, edge-runtime convex-test), Next.js 16 + React + Motion (`apps/dashboard`), next-intl / `@workspace/i18n` (five locale files, parity-guarded), Turborepo + Bun, Vitest 4 (`bun run test`). Pre-commit hook runs Biome on staged files + full typecheck + `turbo run test`.

---

### Task 1: Read the animation rules before any animation work

**Files:**
- Read: `docs/ui-animation.md`
- Read: `apps/dashboard/components/onboarding/onboarding-wizard.tsx` (existing `AnimatePresence mode="wait"` crossfade at lines 245-255)
- Read: `apps/dashboard/lib/motion.ts` (the shared `SPRING` transition)

- [ ] Read `docs/ui-animation.md` end to end. It records bugs already shipped once: FLIP scale distortion, height-vs-box-model clamping, gap collapse, overflow vs corner overlaps. The score step reuses the wizard's existing `AnimatePresence mode="wait"` opacity crossfade (no new layout/FLIP animation), so the goal of this read is to confirm that the per-phase swap inside the score step stays an opacity-only crossfade in a fixed frame and never animates height/gap on existing content.
- [ ] Confirm `MotionConfig reducedMotion="user"` is set globally (it is, per the project rules) and that no code in this plan bypasses it: the score step adds no new `MotionConfig` and uses only `motion.div` opacity transitions, which respect the global setting automatically.
- [ ] No commit (reading only). This task gates all later animation work.

---

### Task 2: `getOnboardingStatus` gains `hasRoles`

**Files:**
- Modify: `packages/backend/convex/accounts/onboarding.ts` (the `getOnboardingStatus` query, lines 15-75: returns validator lines 17-32 and the handler return object lines 64-73)
- Test: `packages/backend/convex/accounts/onboarding.test.ts` (the `describe("getOnboardingStatus")` block, lines 13-147)

- [ ] Write the failing test. Add this `it` block inside the existing `describe("getOnboardingStatus")` block in `packages/backend/convex/accounts/onboarding.test.ts`, immediately after the `it("returns the member's role verbatim for editors", ...)` test (before the closing `})` of the describe at line 147):

```ts
  it("reports hasRoles once the org has at least one role", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAdmin(t)
    const asUser = t.withIdentity({ subject: userId })

    // No roles yet: hasRoles is false.
    let status = await asUser.query(
      api.accounts.onboarding.getOnboardingStatus,
      {}
    )
    expect(status?.hasRoles).toBe(false)

    // Insert one role: hasRoles flips true.
    await t.run(async (ctx) => {
      await ctx.db.insert("roles", {
        orgId,
        title: "Developer",
        function: "Engineering",
        team: "Core",
        trackKey: "IC",
        purpose: "",
        responsibilities: "",
        status: "draft",
      })
    })
    status = await asUser.query(api.accounts.onboarding.getOnboardingStatus, {})
    expect(status?.hasRoles).toBe(true)
  })
```

- [ ] Run the test to verify it fails. Command (run from the repo root):

```
bun run test --filter @workspace/backend -- onboarding
```

Expected: the new test fails because `status.hasRoles` is `undefined` (the returns validator does not include `hasRoles`), so `expect(status?.hasRoles).toBe(false)` reports `expected false, received undefined` (or a validator error on the unknown field). All other `getOnboardingStatus` tests still pass.

- [ ] Write the minimal implementation. In `packages/backend/convex/accounts/onboarding.ts`, add `hasRoles` to the returns validator. Change the object inside `returns` (lines 19-31) so the field list reads:

```ts
    v.object({
      organization: v.union(
        v.null(),
        v.object({
          orgId: v.string(),
          name: v.string(),
          role: v.string(),
        })
      ),
      settingsComplete: v.boolean(),
      hasModel: v.boolean(),
      hasRoles: v.boolean(),
      completed: v.boolean(),
    })
```

- [ ] In the same file, add `hasRoles: false` to the member-less early return (the object at lines 42-47) so it reads:

```ts
      return {
        organization: null,
        settingsComplete: false,
        hasModel: false,
        hasRoles: false,
        completed: false,
      }
```

- [ ] In the same file, in the main handler, after the `model` lookup (line 60-63) and before the final `return` (line 64), add a roles lookup and include `hasRoles` in the returned object. Replace the final return block (lines 64-73) with:

```ts
    const firstRole = await ctx.db
      .query("roles")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .first()
    return {
      organization: {
        orgId,
        name: first.organizationName,
        role: first.role,
      },
      settingsComplete,
      hasModel: model !== null,
      hasRoles: firstRole !== null,
      completed: typeof settings?.onboardingCompletedAt === "number",
    }
```

- [ ] Run codegen so the generated API types include the new return shape. Command (run from `packages/backend`):

```
bash -c "cd packages/backend && bunx convex codegen --typecheck disable"
```

Expected: codegen completes with no error and regenerates `packages/backend/convex/_generated/`.

- [ ] Run the test to verify it passes. Command:

```
bun run test --filter @workspace/backend -- onboarding
```

Expected: all `getOnboardingStatus` tests pass, including the new `reports hasRoles once the org has at least one role`.

- [ ] Commit. Commands (run from the repo root):

```
git add packages/backend/convex/accounts/onboarding.ts packages/backend/convex/accounts/onboarding.test.ts packages/backend/convex/_generated
git commit -m "feat(onboarding): getOnboardingStatus reports hasRoles

Score-step rewiring needs a server-derived signal that the org has at
least one role, so families.isComplete can follow it and the wizard
resumes on the score step after a reload.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Add the i18n keys (English first, then mirror to all five locales)

**Files:**
- Modify: `packages/i18n/messages/en.json` (add keys under `dashboard.onboarding.dots`, `dashboard.onboarding.score`, `dashboard.help`, `dashboard.overview`)
- Modify: `packages/i18n/messages/sv.json`, `packages/i18n/messages/nb.json`, `packages/i18n/messages/da.json`, `packages/i18n/messages/fi.json` (mirror the exact same keys)
- Test: `packages/i18n/messages.test.ts` (the existing parity test, run unchanged)

- [ ] Run the parity test first to confirm it is green before edits. Command (run from the repo root):

```
bun run test --filter @workspace/i18n
```

Expected: passes (all five locales currently carry the same key set).

- [ ] Add the new English keys. In `packages/i18n/messages/en.json`, under `dashboard.onboarding.dots` add the `score` label (alongside the existing `name`/`country`/`industry`/`model`/`families` entries):

```json
    "score": "Score your roles"
```

- [ ] In `packages/i18n/messages/en.json`, add a new `score` object under `dashboard.onboarding` (sibling of `families`):

```json
    "score": {
      "forkHeading": "Your roles are ready. Want to score them now?",
      "scoreNowCta": "Score now",
      "laterCta": "I'll do this later",
      "saveExitLine": "You can save and exit anytime and continue in your dashboard.",
      "saveExitCta": "Save and exit",
      "rolesHeading": "Your roles",
      "roleProgress": "{rated} of {total} criteria rated",
      "scoreRoleCta": "Score this role",
      "resumeRoleCta": "Continue scoring",
      "roleDoneLabel": "Scored",
      "captureHeading": "First, describe this role",
      "captureHint": "A band needs a short written basis. Fill in purpose and responsibilities, or draft them with AI.",
      "purposeLabel": "Purpose",
      "responsibilitiesLabel": "Responsibilities",
      "captureContinueCta": "Continue to scoring",
      "doneHeading": "All roles scored",
      "doneBody": "You have scored every role. You can refine them anytime in your dashboard.",
      "doneCta": "Go to the dashboard",
      "backToRolesCta": "Back to your roles",
      "saveError": "Something went wrong. Try again."
    }
```

- [ ] In `packages/i18n/messages/en.json`, add the help keys under `dashboard.help` (sibling of `blindRatingLabel`/`blindRatingBody`):

```json
    "onboardingScoreLabel": "What does scoring a role do?",
    "onboardingScoreBody": "Scoring rates the role against each criterion in your model. The band is derived from those ratings on a fixed scale, never set by hand, so roles stay comparable. You rate one criterion at a time without seeing the running result."
```

- [ ] In `packages/i18n/messages/en.json`, add a `continueScoring` object under `dashboard.overview` (sibling of `rolesCard` etc.):

```json
    "continueScoring": {
      "title": "Continue scoring",
      "progress": "{scored} of {total} roles scored",
      "cta": "Go to roles"
    }
```

- [ ] Mirror the same keys (same structure, translated values, no em dashes) into `packages/i18n/messages/sv.json`. Swedish values:
  - `dashboard.onboarding.dots.score`: `"Värdera dina roller"`
  - `dashboard.onboarding.score`: `forkHeading` `"Dina roller är klara. Vill du värdera dem nu?"`, `scoreNowCta` `"Värdera nu"`, `laterCta` `"Jag gör det senare"`, `saveExitLine` `"Du kan spara och avsluta när som helst och fortsätta i din instrumentpanel."`, `saveExitCta` `"Spara och avsluta"`, `rolesHeading` `"Dina roller"`, `roleProgress` `"{rated} av {total} kriterier värderade"`, `scoreRoleCta` `"Värdera den här rollen"`, `resumeRoleCta` `"Fortsätt värdera"`, `roleDoneLabel` `"Värderad"`, `captureHeading` `"Beskriv först rollen"`, `captureHint` `"En nivå behöver ett kort skriftligt underlag. Fyll i syfte och ansvar, eller låt AI:n skapa ett utkast."`, `purposeLabel` `"Syfte"`, `responsibilitiesLabel` `"Ansvar"`, `captureContinueCta` `"Fortsätt till värdering"`, `doneHeading` `"Alla roller värderade"`, `doneBody` `"Du har värderat alla roller. Du kan finjustera dem när som helst i instrumentpanelen."`, `doneCta` `"Till instrumentpanelen"`, `backToRolesCta` `"Tillbaka till dina roller"`, `saveError` `"Något gick fel. Försök igen."`
  - `dashboard.help.onboardingScoreLabel`: `"Vad gör en värdering av en roll?"`, `onboardingScoreBody`: `"Värderingen bedömer rollen mot varje kriterium i din modell. Nivån härleds från bedömningarna på en fast skala och sätts aldrig för hand, så roller förblir jämförbara. Du bedömer ett kriterium i taget utan att se det löpande resultatet."`
  - `dashboard.overview.continueScoring`: `title` `"Fortsätt värdera"`, `progress` `"{scored} av {total} roller värderade"`, `cta` `"Till roller"`
- [ ] Mirror the same keys into `packages/i18n/messages/nb.json` (Norwegian Bokmål; flagged for native review). Suggested values:
  - `dashboard.onboarding.dots.score`: `"Vurder rollene dine"`
  - `dashboard.onboarding.score`: `forkHeading` `"Rollene dine er klare. Vil du vurdere dem nå?"`, `scoreNowCta` `"Vurder nå"`, `laterCta` `"Jeg gjør det senere"`, `saveExitLine` `"Du kan lagre og avslutte når som helst og fortsette i dashbordet."`, `saveExitCta` `"Lagre og avslutt"`, `rolesHeading` `"Rollene dine"`, `roleProgress` `"{rated} av {total} kriterier vurdert"`, `scoreRoleCta` `"Vurder denne rollen"`, `resumeRoleCta` `"Fortsett vurderingen"`, `roleDoneLabel` `"Vurdert"`, `captureHeading` `"Beskriv først rollen"`, `captureHint` `"Et nivå trenger et kort skriftlig grunnlag. Fyll inn formål og ansvar, eller lag et utkast med AI."`, `purposeLabel` `"Formål"`, `responsibilitiesLabel` `"Ansvar"`, `captureContinueCta` `"Fortsett til vurdering"`, `doneHeading` `"Alle roller vurdert"`, `doneBody` `"Du har vurdert alle roller. Du kan finjustere dem når som helst i dashbordet."`, `doneCta` `"Til dashbordet"`, `backToRolesCta` `"Tilbake til rollene dine"`, `saveError` `"Noe gikk galt. Prøv igjen."`
  - `dashboard.help.onboardingScoreLabel`: `"Hva gjør en vurdering av en rolle?"`, `onboardingScoreBody`: `"Vurderingen bedømmer rollen mot hvert kriterium i modellen din. Nivået utledes fra vurderingene på en fast skala og settes aldri for hånd, så roller forblir sammenlignbare. Du vurderer ett kriterium om gangen uten å se det løpende resultatet."`
  - `dashboard.overview.continueScoring`: `title` `"Fortsett vurderingen"`, `progress` `"{scored} av {total} roller vurdert"`, `cta` `"Til roller"`
- [ ] Mirror the same keys into `packages/i18n/messages/da.json` (Danish; flagged for native review). Suggested values:
  - `dashboard.onboarding.dots.score`: `"Vurder dine roller"`
  - `dashboard.onboarding.score`: `forkHeading` `"Dine roller er klar. Vil du vurdere dem nu?"`, `scoreNowCta` `"Vurder nu"`, `laterCta` `"Jeg gør det senere"`, `saveExitLine` `"Du kan gemme og afslutte når som helst og fortsætte i dit dashboard."`, `saveExitCta` `"Gem og afslut"`, `rolesHeading` `"Dine roller"`, `roleProgress` `"{rated} af {total} kriterier vurderet"`, `scoreRoleCta` `"Vurder denne rolle"`, `resumeRoleCta` `"Fortsæt vurderingen"`, `roleDoneLabel` `"Vurderet"`, `captureHeading` `"Beskriv først rollen"`, `captureHint` `"Et niveau kræver et kort skriftligt grundlag. Udfyld formål og ansvar, eller lav et udkast med AI."`, `purposeLabel` `"Formål"`, `responsibilitiesLabel` `"Ansvar"`, `captureContinueCta` `"Fortsæt til vurdering"`, `doneHeading` `"Alle roller vurderet"`, `doneBody` `"Du har vurderet alle roller. Du kan finjustere dem når som helst i dashboardet."`, `doneCta` `"Til dashboardet"`, `backToRolesCta` `"Tilbage til dine roller"`, `saveError` `"Noget gik galt. Prøv igen."`
  - `dashboard.help.onboardingScoreLabel`: `"Hvad gør en vurdering af en rolle?"`, `onboardingScoreBody`: `"Vurderingen bedømmer rollen ud fra hvert kriterium i din model. Niveauet udledes af vurderingerne på en fast skala og sættes aldrig i hånden, så roller forbliver sammenlignelige. Du vurderer ét kriterium ad gangen uden at se det løbende resultat."`
  - `dashboard.overview.continueScoring`: `title` `"Fortsæt vurderingen"`, `progress` `"{scored} af {total} roller vurderet"`, `cta` `"Til roller"`
- [ ] Mirror the same keys into `packages/i18n/messages/fi.json` (Finnish; flagged for native review). Suggested values:
  - `dashboard.onboarding.dots.score`: `"Arvioi roolisi"`
  - `dashboard.onboarding.score`: `forkHeading` `"Roolisi ovat valmiit. Haluatko arvioida ne nyt?"`, `scoreNowCta` `"Arvioi nyt"`, `laterCta` `"Teen tämän myöhemmin"`, `saveExitLine` `"Voit tallentaa ja poistua milloin tahansa ja jatkaa hallintapaneelissa."`, `saveExitCta` `"Tallenna ja poistu"`, `rolesHeading` `"Roolisi"`, `roleProgress` `"{rated}/{total} kriteeriä arvioitu"`, `scoreRoleCta` `"Arvioi tämä rooli"`, `resumeRoleCta` `"Jatka arviointia"`, `roleDoneLabel` `"Arvioitu"`, `captureHeading` `"Kuvaile ensin rooli"`, `captureHint` `"Taso tarvitsee lyhyen kirjallisen perustan. Täytä tarkoitus ja vastuut tai luo luonnos tekoälyllä."`, `purposeLabel` `"Tarkoitus"`, `responsibilitiesLabel` `"Vastuut"`, `captureContinueCta` `"Jatka arviointiin"`, `doneHeading` `"Kaikki roolit arvioitu"`, `doneBody` `"Olet arvioinut kaikki roolit. Voit hienosäätää niitä milloin tahansa hallintapaneelissa."`, `doneCta` `"Hallintapaneeliin"`, `backToRolesCta` `"Takaisin rooleihisi"`, `saveError` `"Jokin meni vikaan. Yritä uudelleen."`
  - `dashboard.help.onboardingScoreLabel`: `"Mitä roolin arviointi tekee?"`, `onboardingScoreBody`: `"Arviointi vertaa roolia mallisi jokaiseen kriteeriin. Taso johdetaan arvioinneista kiinteällä asteikolla, eikä sitä koskaan aseteta käsin, joten roolit pysyvät vertailukelpoisina. Arvioit yhden kriteerin kerrallaan näkemättä juoksevaa tulosta."`
  - `dashboard.overview.continueScoring`: `title` `"Jatka arviointia"`, `progress` `"{scored}/{total} roolia arvioitu"`, `cta` `"Rooleihin"`
- [ ] Run the parity test to verify it passes. Command:

```
bun run test --filter @workspace/i18n
```

Expected: passes. The parity test fails if any locale's key set differs from `en.json`; all five now carry the identical new keys, so it stays green.

- [ ] Commit. Commands:

```
git add packages/i18n/messages/en.json packages/i18n/messages/sv.json packages/i18n/messages/nb.json packages/i18n/messages/da.json packages/i18n/messages/fi.json
git commit -m "feat(i18n): add score-step, score-help, and continue-scoring keys

New keys for the opt-in score onboarding step (dots.score,
onboarding.score.*), its help popover (help.onboardingScore{Label,Body}),
and the dashboard continue-scoring card (overview.continueScoring.*).
nb/da/fi flagged for native review.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `families-step` stops completing onboarding (advance only)

**Files:**
- Modify: `apps/dashboard/components/onboarding/families-step.tsx` (remove the `completeOnboarding` mutation hook at lines 71-73 and its call at line 173; both the template and AI-import paths flow through `finish`)
- Test: `apps/dashboard/components/onboarding/families-step.test.tsx` (the existing tests at lines 213-472 assert `completeOnboardingMock` was called; rewrite those assertions to expect it is NOT called and `onFinished` (now meaning "advance") still fires)

- [ ] Write the failing tests. In `apps/dashboard/components/onboarding/families-step.test.tsx`, the families step now creates the starter set and calls `onAdvance` (which the wizard wires to `latchNext`, not `finish`); it must no longer call `completeOnboarding`. Update the three tests that assert completion. First, in `it("seeds review from a suggested import, coerces unknown tracks, and confirms with the edited list", ...)` (lines 213-246), replace the assertion block that waits on `completeOnboardingMock` with a wait on `confirmStarterImportMock` and an explicit non-call of `completeOnboardingMock`:

```ts
    fireEvent.click(screen.getByRole("button", { name: t.createCta }))
    await waitFor(() => {
      expect(confirmStarterImportMock).toHaveBeenCalledTimes(1)
    })
    expect(confirmStarterImportMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "IC" },
          ],
        },
      ],
    })
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
```

- [ ] In `it("the template button seeds from the industry starter and creates via createStarterSet", ...)` (lines 248-285), replace the `await waitFor` block that waits on `completeOnboardingMock` with a wait on `createStarterSetMock` and assert `completeOnboardingMock` was not called:

```ts
    fireEvent.click(screen.getByRole("button", { name: t.createCta }))
    await waitFor(() => {
      expect(createStarterSetMock).toHaveBeenCalledTimes(1)
    })
    expect(createStarterSetMock).toHaveBeenCalledWith({
      orgId: "org-1",
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            { title: "Tech Lead", trackKey: "Lead" },
          ],
        },
        {
          name: "Sales",
          roles: [{ title: "Account Executive", trackKey: "IC" }],
        },
      ],
    })
    expect(completeOnboardingMock).not.toHaveBeenCalled()
    expect(confirmStarterImportMock).not.toHaveBeenCalled()
    expect(onFinished).toHaveBeenCalledTimes(1)
```

- [ ] In `it("finishing with only blank families completes without creating", ...)` (lines 339-359), rename intent: it now advances without creating and without completing. Replace its body's final assertions:

```ts
    fireEvent.click(screen.getByRole("button", { name: t.createCta }))

    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(createStarterSetMock).not.toHaveBeenCalled()
    expect(completeOnboardingMock).not.toHaveBeenCalled()
```

- [ ] In `it("retrying after a failed completion does not re-run the creation", ...)` (lines 447-472): this test simulated a failing `completeOnboarding`. Since the families step no longer calls `completeOnboarding`, rewrite it to simulate a failing `confirmStarterImport` retry (the creation is the only write here now). Replace the whole `it` body with:

```ts
  it("retrying after a failed creation re-runs the confirm only", async () => {
    currentSuggestions = [suggestedImportFixture()]
    confirmStarterImportMock
      .mockRejectedValueOnce(new Error("ConvexError: errors.notFound"))
      .mockResolvedValueOnce(null)
    const onFinished = vi.fn()
    renderStep(onFinished)
    await screen.findAllByLabelText(messages.dashboard.roles.family.nameLabel)

    // First attempt: the confirm throws, the step stays and shows the alert.
    fireEvent.click(screen.getByRole("button", { name: t.createCta }))
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(onFinished).not.toHaveBeenCalled()

    // Retry: the confirm re-runs and now succeeds, then the step advances.
    fireEvent.click(screen.getByRole("button", { name: t.createCta }))
    await waitFor(() => {
      expect(onFinished).toHaveBeenCalledTimes(1)
    })
    expect(confirmStarterImportMock).toHaveBeenCalledTimes(2)
    expect(completeOnboardingMock).not.toHaveBeenCalled()
  })
```

- [ ] Run the tests to verify they fail. Command (run from the repo root):

```
bun run test --filter @workspace/dashboard -- families-step
```

Expected: the four rewritten tests fail because `families-step.tsx` still calls `completeOnboardingMock` (so `expect(completeOnboardingMock).not.toHaveBeenCalled()` fails), and `created`-based retry logic still gates on the old `completeOnboarding` path.

- [ ] Write the minimal implementation. In `apps/dashboard/components/onboarding/families-step.tsx`, remove the `completeOnboarding` mutation hook (lines 71-73). Delete:

```ts
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )
```

- [ ] In the same file, rewrite the `finish` function (lines 154-179) so it creates the starter set (or confirms the import) and then advances, with no `completeOnboarding` call. The `created` guard stays so a retry after a failed creation does not double-create; advancing happens immediately after a successful create. New body:

```ts
  async function finish() {
    setPending(true)
    setFailure(null)
    try {
      if (!created) {
        const cleaned = draft.cleaned()
        if (seededFrom?.source === "ai") {
          // The AI path closes the suggestion with the user's edited list;
          // an emptied list confirms nothing and rejects the suggestion.
          await confirmStarterImport({
            orgId,
            suggestionId: seededFrom.suggestionId,
            families: cleaned,
          })
        } else if (cleaned.length > 0) {
          await createStarterSet({ orgId, families: cleaned })
        }
        setCreated(true)
      }
      // Onboarding is NOT completed here: the score step owns completion on
      // every exit path. This step only creates the starter set and advances.
      onAdvance()
    } catch (error) {
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setPending(false)
    }
  }
```

- [ ] Update the file's leading comment block (lines 38-40) so it no longer claims this step completes onboarding. Replace the sentence "Both paths complete onboarding." with "Both paths create the starter set and advance to the score step." (the score step now owns completion).

- [ ] Run the tests to verify they pass. Command:

```
bun run test --filter @workspace/dashboard -- families-step
```

Expected: all `FamiliesStep` tests pass, including the four rewritten ones.

- [ ] Commit. Commands:

```
git add apps/dashboard/components/onboarding/families-step.tsx apps/dashboard/components/onboarding/families-step.test.tsx
git commit -m "refactor(onboarding): families-step advances instead of completing

The families step now creates the starter set and advances; the new
score step owns completeOnboarding on every exit path. The retry guard
(created) now protects the creation alone.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The per-role scoring wrapper (`score-role.tsx`)

**Files:**
- Create: `apps/dashboard/components/onboarding/score-role.tsx`
- Create: `apps/dashboard/components/onboarding/score-role.test.tsx`

This wrapper drives one role through: inline profile capture (the two fields + `RoleAiPanel`), then the blind `RatingStepper`, then the `RatingResult` reveal, then "back to the list". It reuses `RatingStepper`, `RatingResult`, and `RoleAiPanel` unchanged. The AI panel's open/close state lives in `ScoreRole`'s top-level `useState` and the trigger/panel are rendered by a plain `renderAiPanel()` helper, NOT a nested component: a component declared inside the parent gets a new identity on every render and remounts (the same convention documented in `families-step.tsx` lines 245-247, where the parent re-renders on every keystroke in the purpose/responsibilities `Textarea`).

- [ ] Write the failing test. Create `apps/dashboard/components/onboarding/score-role.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

import { mockMutation, onQuery } from "@/test/convex-mocks"

const updateRoleMock = mockMutation("assessment.roles.updateRole")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () =>
  (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock("@workspace/backend/convex/_generated/api", async () =>
  (await import("@/test/convex-mocks")).apiModule
)

// The stepper and result and AI panel are reused unchanged; mock them as
// markers so this test asserts only the wrapper's phase machine. The AI panel
// mock exposes an onDone button so the open/close state can be exercised.
vi.mock("@/components/rating/rating-stepper", () => ({
  RatingStepper: (props: { onCompleted: () => void }) => (
    <div data-testid="stepper">
      <button type="button" onClick={() => props.onCompleted()}>
        stepper-done
      </button>
    </div>
  ),
}))
vi.mock("@/components/rating/rating-result", () => ({
  RatingResult: () => <div data-testid="result" />,
}))
vi.mock("@/components/roles/role-ai-panel", () => ({
  RoleAiPanel: (props: { onDone: () => void }) => (
    <div data-testid="ai-panel">
      <button type="button" onClick={() => props.onDone()}>
        ai-done
      </button>
    </div>
  ),
}))

import { ScoreRole } from "@/components/onboarding/score-role"

const t = messages.dashboard.onboarding.score
const tRoleAi = messages.dashboard.roles.ai

// getRole returns a role with empty profile, getModel returns the criteria.
function roleFixture(overrides: Record<string, unknown> = {}) {
  return {
    roleId: "role-1",
    title: "Developer",
    function: "Engineering",
    team: "Core",
    trackKey: "IC",
    trackName: "Individual Contributor",
    purpose: "",
    responsibilities: "",
    status: "draft",
    archived: false,
    profileComplete: false,
    ratedCount: 0,
    totalCriteria: 5,
    familyId: null,
    familyName: null,
    anchorRole: null,
    ratings: [],
    ...overrides,
  }
}

function modelFixture() {
  return {
    modelId: "model-1",
    name: "Standard",
    templateKey: "standard",
    criteria: [
      {
        criterionId: "c1",
        name: "Knowledge",
        description: "",
        helpText: "",
        weightPoints: 3,
        order: 1,
        isCustom: false,
        anchors: [{ level: 0, text: "none" }],
      },
    ],
    tracks: [],
    bandThresholds: [],
  }
}

let currentRole: unknown
let currentModel: unknown

function renderRole(onDone: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScoreRole orgId="org-1" roleId="role-1" onDone={onDone} />
    </NextIntlClientProvider>
  )
}

describe("ScoreRole", () => {
  beforeEach(() => {
    updateRoleMock.mockReset()
    useQueryMock.mockReset()
    currentRole = roleFixture()
    currentModel = modelFixture()
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.roles.getRole") return currentRole
      if (ref === "evaluationModel.model.getModel") return currentModel
      return undefined
    })
  })

  afterEach(() => cleanup())

  it("opens on profile capture when the profile is empty", () => {
    renderRole()
    expect(screen.getByLabelText(t.purposeLabel)).toBeDefined()
    expect(screen.getByLabelText(t.responsibilitiesLabel)).toBeDefined()
    expect(screen.queryByTestId("stepper")).toBeNull()
  })

  it("opens the AI panel from the trigger and keeps it open across a keystroke", () => {
    renderRole()
    // The AI panel is collapsed behind a trigger button.
    expect(screen.queryByTestId("ai-panel")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: tRoleAi.draftCta }))
    expect(screen.getByTestId("ai-panel")).toBeDefined()
    // Typing in the purpose field re-renders the parent; the panel stays open
    // because its open state lives in ScoreRole, not in a nested component.
    fireEvent.change(screen.getByLabelText(t.purposeLabel), {
      target: { value: "Builds the product." },
    })
    expect(screen.getByTestId("ai-panel")).toBeDefined()
    // Closing the panel via its onDone returns to the trigger.
    fireEvent.click(screen.getByRole("button", { name: "ai-done" }))
    expect(screen.queryByTestId("ai-panel")).toBeNull()
    expect(screen.getByRole("button", { name: tRoleAi.draftCta })).toBeDefined()
  })

  it("saves the profile and advances to the blind stepper", async () => {
    updateRoleMock.mockResolvedValue(null)
    renderRole()
    fireEvent.change(screen.getByLabelText(t.purposeLabel), {
      target: { value: "Builds the product." },
    })
    fireEvent.change(screen.getByLabelText(t.responsibilitiesLabel), {
      target: { value: "Ships features." },
    })
    fireEvent.click(screen.getByRole("button", { name: t.captureContinueCta }))
    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith({
        orgId: "org-1",
        roleId: "role-1",
        purpose: "Builds the product.",
        responsibilities: "Ships features.",
      })
    })
    expect(await screen.findByTestId("stepper")).toBeDefined()
  })

  it("skips capture and opens the stepper when the profile is already complete", () => {
    currentRole = roleFixture({
      profileComplete: true,
      purpose: "p",
      responsibilities: "r",
    })
    renderRole()
    expect(screen.getByTestId("stepper")).toBeDefined()
    expect(screen.queryByLabelText(t.purposeLabel)).toBeNull()
  })

  it("reveals the result after the stepper completes, then returns to the list", async () => {
    currentRole = roleFixture({
      profileComplete: true,
      purpose: "p",
      responsibilities: "r",
    })
    const onDone = vi.fn()
    renderRole(onDone)
    fireEvent.click(screen.getByText("stepper-done"))
    expect(await screen.findByTestId("result")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: t.backToRolesCta }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] Run the test to verify it fails. Command:

```
bun run test --filter @workspace/dashboard -- score-role
```

Expected: fails to resolve `@/components/onboarding/score-role` (module does not exist yet), so every test in the file errors on import.

- [ ] Write the minimal implementation. Create `apps/dashboard/components/onboarding/score-role.tsx`. The AI panel's `open` state is a top-level `useState` in `ScoreRole`, and the trigger/panel are produced by a plain `renderAiPanel()` helper (NOT a nested component), so typing in the capture fields never remounts the panel:

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import { Spinner } from "@workspace/ui/components/spinner"
import { Textarea } from "@workspace/ui/components/textarea"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { RatingResult } from "@/components/rating/rating-result"
import { RatingStepper } from "@/components/rating/rating-stepper"
import { RoleAiPanel } from "@/components/roles/role-ai-panel"

// One role's inline scoring inside the wizard: profile capture (the two
// mandatory fields, with RoleAiPanel for a one-click AI draft), then the
// blind RatingStepper (auto-saves per criterion), then the RatingResult
// reveal. "Back to your roles" returns to the list. The stepper, result,
// and AI panel are reused unchanged.
export function ScoreRole({
  orgId,
  roleId,
  onDone,
}: {
  orgId: string
  roleId: string
  // Called when the user leaves the role (after the reveal) back to the list.
  onDone: () => void
}) {
  const t = useTranslations("dashboard.onboarding.score")
  const tHelp = useTranslations("dashboard.help")
  const tRoleAi = useTranslations("dashboard.roles.ai")
  const locale = useLocale()
  const role = useQuery(api.assessment.roles.getRole, { orgId, roleId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const updateRole = useMutation(api.assessment.roles.updateRole)

  const [purpose, setPurpose] = useState("")
  const [responsibilities, setResponsibilities] = useState("")
  const [savedProfile, setSavedProfile] = useState(false)
  const [finished, setFinished] = useState(false)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  // The AI panel's open/close lives here at the top level: lifting it out of
  // the trigger means typing in the capture fields (which re-renders this
  // component) never remounts the panel. See families-step.tsx for the same
  // "render helper, not nested component" convention.
  const [aiOpen, setAiOpen] = useState(false)
  // Seed the capture fields once from the role (an AI draft applied via the
  // panel patches the role, so the query reactively refills these too).
  const [seeded, setSeeded] = useState(false)
  if (!seeded && role !== undefined && role !== null) {
    setSeeded(true)
    setPurpose(role.purpose)
    setResponsibilities(role.responsibilities)
  }

  if (role === undefined || model === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("rolesHeading")} />
      </main>
    )
  }
  if (role === null || model === null) return null

  if (finished) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <RatingResult orgId={orgId} roleId={roleId} />
        <Button type="button" variant="outline" onClick={onDone}>
          {t("backToRolesCta")}
        </Button>
      </div>
    )
  }

  // Plain render helper, NOT a component: a component defined inside the
  // parent gets a new identity every render and would remount the panel
  // (collapsing it on every keystroke in the capture fields).
  function renderAiPanel() {
    if (!aiOpen) {
      return (
        <Button type="button" variant="outline" onClick={() => setAiOpen(true)}>
          {tRoleAi("draftCta")}
        </Button>
      )
    }
    return (
      <RoleAiPanel orgId={orgId} roleId={roleId} onDone={() => setAiOpen(false)} />
    )
  }

  // The profile gate: the role needs purpose + responsibilities before the
  // blind stepper. A starter role opens empty, so capture comes first.
  if (!role.profileComplete && !savedProfile) {
    const canContinue =
      purpose.trim().length > 0 && responsibilities.trim().length > 0
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-medium text-lg">{t("captureHeading")}</h2>
          <HelpMorphButton label={tHelp("onboardingScoreLabel")}>
            {tHelp("onboardingScoreBody")}
          </HelpMorphButton>
        </div>
        <p className="text-muted-foreground text-sm">{t("captureHint")}</p>
        <div className="flex justify-end">{renderAiPanel()}</div>
        <div className="space-y-2">
          <Label htmlFor="score-role-purpose">{t("purposeLabel")}</Label>
          <Textarea
            id="score-role-purpose"
            value={purpose}
            rows={3}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="score-role-responsibilities">
            {t("responsibilitiesLabel")}
          </Label>
          <Textarea
            id="score-role-responsibilities"
            value={responsibilities}
            rows={3}
            onChange={(event) => setResponsibilities(event.target.value)}
          />
        </div>
        {failed && (
          <p role="alert" className="text-destructive text-sm">
            {t("saveError")}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={!canContinue || pending}
            onClick={async () => {
              setPending(true)
              setFailed(false)
              try {
                await updateRole({
                  orgId,
                  roleId: role.roleId,
                  purpose: purpose.trim(),
                  responsibilities: responsibilities.trim(),
                })
                setSavedProfile(true)
              } catch {
                setFailed(true)
              } finally {
                setPending(false)
              }
            }}
          >
            {t("captureContinueCta")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="font-medium text-lg">{role.title}</h2>
      <RatingStepper
        orgId={orgId}
        roleId={role.roleId}
        criteria={model.criteria}
        ratings={role.ratings}
        onCompleted={() => setFinished(true)}
      />
    </div>
  )
}
```

Note: `model.criteria` already matches the `StepperCriterion[]` shape `RatingStepper` expects (criterionId, name, description, helpText, anchors), and `role.ratings` matches the `ratings` prop, so both are passed through unchanged. `renderAiPanel` is declared after the `finished` early return so `role`/`roleId` are in scope; because it is a plain function (not a JSX component), it does not introduce a remounting subtree.

- [ ] Run the test to verify it passes. Command:

```
bun run test --filter @workspace/dashboard -- score-role
```

Expected: all five `ScoreRole` tests pass, including the AI-panel-stays-open-across-a-keystroke test.

- [ ] Commit. Commands:

```
git add apps/dashboard/components/onboarding/score-role.tsx apps/dashboard/components/onboarding/score-role.test.tsx
git commit -m "feat(onboarding): per-role inline scoring wrapper

ScoreRole drives one starter role through profile capture (two fields +
RoleAiPanel), then the blind RatingStepper, then the RatingResult reveal,
then back to the list. The AI panel's open state lives at the top level
and renders via a plain helper, not a nested component, so typing in the
capture fields never remounts it. Stepper, result, and AI panel reused
unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: The score step (fork screen, scoring list, completion)

**Files:**
- Create: `apps/dashboard/components/onboarding/score-step.tsx`
- Create: `apps/dashboard/components/onboarding/score-step.test.tsx`

The step has three phases: the fork (only when no role is started), the scoring list (with the persistent save-and-exit line and button), and a per-role view (delegates to `ScoreRole`). Every exit path (`later`, `save and exit`, `all complete`) calls `completeOnboarding` then `onFinish`.

The fork-skip signal: `assessment.results.getResults` exposes `ratedCount` and `complete` per row but NO profile/purpose field (see its returns validator in `packages/backend/convex/assessment/results.ts` lines 14-32). So "started" is defined as **any role has at least one rating** (`ratedCount > 0`, or the role is already `complete`). A role that has a saved profile but zero ratings is intentionally NOT counted as started: the profile-only case is invisible to `getResults`, and the fork's job is only to gate the very first entry. This narrows the spec sentence ("a rating or a non-empty profile") to "a rating", and the plan is internally consistent with both `getResults` and the score-step code. No backend change is needed.

- [ ] Write the failing test. Create `apps/dashboard/components/onboarding/score-step.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

import { mockMutation, onQuery } from "@/test/convex-mocks"

const completeOnboardingMock = mockMutation(
  "accounts.organization.completeOnboarding"
)
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () =>
  (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock("@workspace/backend/convex/_generated/api", async () =>
  (await import("@/test/convex-mocks")).apiModule
)

// The per-role wrapper is mocked as a marker; the step's own tests cover the
// fork, the list, and completion.
vi.mock("@/components/onboarding/score-role", () => ({
  ScoreRole: (props: { roleId: string; onDone: () => void }) => (
    <div data-testid="score-role">
      <span data-testid="score-role-id">{props.roleId}</span>
      <button type="button" onClick={() => props.onDone()}>
        role-done
      </button>
    </div>
  ),
}))

import { ScoreStep } from "@/components/onboarding/score-step"

const t = messages.dashboard.onboarding.score

// getResults rows: each row has complete + ratedCount + a non-empty title.
function resultsFixture(rows: Array<Record<string, unknown>>) {
  return {
    rows: rows.map((row) => ({
      roleId: "role-x",
      title: "Role",
      trackKey: "IC",
      trackName: "IC",
      status: "draft",
      complete: false,
      ratedCount: 0,
      totalCriteria: 5,
      score: null,
      band: null,
      familyId: null,
      familyName: null,
      ...row,
    })),
    bands: [],
  }
}

let currentResults: unknown

function renderStep(onFinish: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScoreStep orgId="org-1" onFinish={onFinish} />
    </NextIntlClientProvider>
  )
}

describe("ScoreStep", () => {
  beforeEach(() => {
    completeOnboardingMock.mockReset()
    useQueryMock.mockReset()
    completeOnboardingMock.mockResolvedValue(null)
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults") return currentResults
      return undefined
    })
  })

  afterEach(() => cleanup())

  it("shows the fork when no role has been started", () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 0, complete: false },
      { roleId: "role-2", title: "B", ratedCount: 0, complete: false },
    ])
    renderStep()
    expect(screen.getByText(t.forkHeading)).toBeDefined()
    expect(screen.getByRole("button", { name: t.scoreNowCta })).toBeDefined()
    expect(screen.getByRole("button", { name: t.laterCta })).toBeDefined()
  })

  it("'I'll do this later' completes onboarding and finishes", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 0, complete: false },
    ])
    const onFinish = vi.fn()
    renderStep(onFinish)
    fireEvent.click(screen.getByRole("button", { name: t.laterCta }))
    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it("'Score now' opens the scoring list with the save-and-exit affordance", () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 0, complete: false },
    ])
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.scoreNowCta }))
    expect(screen.getByText(t.saveExitLine)).toBeDefined()
    expect(screen.getByRole("button", { name: t.saveExitCta })).toBeDefined()
  })

  it("skips the fork when a role is already started (ratedCount > 0)", () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 2, complete: false },
    ])
    renderStep()
    // No fork: it lands straight on the scoring list.
    expect(screen.queryByText(t.forkHeading)).toBeNull()
    expect(screen.getByText(t.saveExitLine)).toBeDefined()
  })

  it("'Save and exit' completes onboarding and finishes", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 2, complete: false },
    ])
    const onFinish = vi.fn()
    renderStep(onFinish)
    fireEvent.click(screen.getByRole("button", { name: t.saveExitCta }))
    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it("shows the done state and completes when every role is complete", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 5, complete: true },
      { roleId: "role-2", title: "B", ratedCount: 5, complete: true },
    ])
    const onFinish = vi.fn()
    renderStep(onFinish)
    expect(screen.getByText(t.doneHeading)).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: t.doneCta }))
    await waitFor(() => {
      expect(completeOnboardingMock).toHaveBeenCalledWith({ orgId: "org-1" })
    })
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it("opens a role from the list and returns after the role is done", async () => {
    currentResults = resultsFixture([
      { roleId: "role-1", title: "A", ratedCount: 1, complete: false },
    ])
    renderStep()
    fireEvent.click(screen.getByRole("button", { name: t.resumeRoleCta }))
    expect(screen.getByTestId("score-role-id").textContent).toBe("role-1")
    fireEvent.click(screen.getByText("role-done"))
    await waitFor(() => {
      expect(screen.queryByTestId("score-role")).toBeNull()
    })
    expect(screen.getByText(t.saveExitLine)).toBeDefined()
  })
})
```

- [ ] Run the test to verify it fails. Command:

```
bun run test --filter @workspace/dashboard -- score-step
```

Expected: fails to resolve `@/components/onboarding/score-step` (module does not exist), so every test errors on import.

- [ ] Write the minimal implementation. Create `apps/dashboard/components/onboarding/score-step.tsx`. The `anyStarted` derivation uses only fields `getResults` exposes (`ratedCount`, `complete`); a profile-only role is intentionally not counted (the fork only gates first entry):

```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { ScoreRole } from "@/components/onboarding/score-role"
import { ScreenShell } from "@/components/onboarding/screen-shell"

// The final onboarding step: opt-in scoring with a save-and-exit escape on
// every path. The fork screen shows only when no role is started; otherwise
// it lands on the scoring list. Reaching this step and leaving it by any
// path (later, save and exit, all complete) completes onboarding, which is
// what flips the gate to the dashboard. Score/band are derived and never
// stored (ADR-0002); this step writes nothing but the per-criterion ratings
// and the profile fields (in ScoreRole), then calls completeOnboarding.
export function ScoreStep({
  orgId,
  onFinish,
}: {
  orgId: string
  // The wizard's finish callback: hands control back to the onboarding gate.
  onFinish: () => void
}) {
  const t = useTranslations("dashboard.onboarding.score")
  const tHelp = useTranslations("dashboard.help")
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )

  // The user explicitly chose to score now (or no fork was needed). The fork
  // is skipped once any role has been started.
  const [scoring, setScoring] = useState(false)
  // The role currently open in the per-role view, or null for the list.
  const [openRoleId, setOpenRoleId] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)

  // Every exit path runs through here: complete onboarding, then finish.
  async function exit() {
    if (exiting) return
    setExiting(true)
    try {
      await completeOnboarding({ orgId })
      onFinish()
    } catch {
      // completeOnboarding is idempotent and the gate stays on this step on
      // failure; re-enable the control so the user can retry.
      setExiting(false)
    }
  }

  if (results === undefined) {
    return (
      <main className="flex items-center justify-center p-6">
        <Spinner aria-label={t("rolesHeading")} />
      </main>
    )
  }

  const rows = results.rows
  const total = rows.length
  const scored = rows.filter((row) => row.complete).length
  // "Started" = any role has at least one rating (or is complete). getResults
  // exposes no profile field, so a profile-only role is intentionally not
  // counted here; the fork only gates the very first entry into scoring.
  const anyStarted = rows.some((row) => row.ratedCount > 0 || row.complete)
  const allComplete = total > 0 && scored === total

  // Phase selection. mode="wait" opacity crossfade reuses the wizard frame's
  // animation language; no height/layout animation (docs/ui-animation.md).
  const phase =
    openRoleId !== null
      ? "role"
      : allComplete
        ? "done"
        : scoring || anyStarted
          ? "list"
          : "fork"

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={phase}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {phase === "role" && openRoleId !== null ? (
          <ScoreRole
            orgId={orgId}
            roleId={openRoleId}
            onDone={() => setOpenRoleId(null)}
          />
        ) : phase === "fork" ? (
          <ScreenShell heading={t("forkHeading")}>
            <div className="flex items-center justify-center">
              <HelpMorphButton label={tHelp("onboardingScoreLabel")}>
                {tHelp("onboardingScoreBody")}
              </HelpMorphButton>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={exiting}
                onClick={() => exit()}
              >
                {t("laterCta")}
              </Button>
              <Button type="button" onClick={() => setScoring(true)}>
                {t("scoreNowCta")}
              </Button>
            </div>
          </ScreenShell>
        ) : phase === "done" ? (
          <ScreenShell heading={t("doneHeading")} description={t("doneBody")}>
            <Button type="button" disabled={exiting} onClick={() => exit()}>
              {t("doneCta")}
            </Button>
          </ScreenShell>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-lg">{t("rolesHeading")}</h2>
              <HelpMorphButton label={tHelp("onboardingScoreLabel")}>
                {tHelp("onboardingScoreBody")}
              </HelpMorphButton>
            </div>
            {/* Persistent reassurance line, in its own slot so opting in does
                not reflow the list below it. */}
            <p className="text-muted-foreground text-sm">{t("saveExitLine")}</p>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.roleId}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium text-sm">{row.title}</p>
                    <p className="text-muted-foreground text-sm">
                      {t("roleProgress", {
                        rated: row.ratedCount,
                        total: row.totalCriteria,
                      })}
                    </p>
                    <Progress
                      value={
                        row.totalCriteria === 0
                          ? 0
                          : (row.ratedCount / row.totalCriteria) * 100
                      }
                    />
                  </div>
                  {row.complete ? (
                    <span className="text-muted-foreground text-sm">
                      {t("roleDoneLabel")}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenRoleId(row.roleId)}
                    >
                      {row.ratedCount > 0
                        ? t("resumeRoleCta")
                        : t("scoreRoleCta")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={exiting}
                onClick={() => exit()}
              >
                {t("saveExitCta")}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] Run the test to verify it passes. Command:

```
bun run test --filter @workspace/dashboard -- score-step
```

Expected: all seven `ScoreStep` tests pass.

- [ ] Commit. Commands:

```
git add apps/dashboard/components/onboarding/score-step.tsx apps/dashboard/components/onboarding/score-step.test.tsx
git commit -m "feat(onboarding): opt-in score step (fork, list, completion)

The final onboarding step: a fork screen (only when no role is started,
where started means any role has a rating since getResults exposes no
profile field), a scoring list with a persistent save-and-exit
affordance, and a done state. Every exit path completes onboarding then
finishes. Reuses the ScoreRole wrapper and the wizard's opacity crossfade.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wire the score step into the wizard `STEPS` array

**Files:**
- Modify: `apps/dashboard/components/onboarding/onboarding-wizard.tsx` (the `OnboardingStatus` interface lines 17-22; the `families` STEP `isComplete` line 114; add a new `score` STEP after `families` lines 111-123)
- Test: `apps/dashboard/components/onboarding/onboarding-wizard.test.tsx` (add a `score-step` mock and resume/exit tests)

- [ ] Write the failing tests. In `apps/dashboard/components/onboarding/onboarding-wizard.test.tsx`, first add a `score-step` mock alongside the existing `families-step` mock (after the block at lines 78-87):

```tsx
vi.mock("@/components/onboarding/score-step", () => ({
  ScoreStep: (props: { orgId: string; onFinish: () => void }) => (
    <div data-testid="score-step">
      <span data-testid="score-orgid">{props.orgId}</span>
      <button type="button" onClick={() => props.onFinish()}>
        score-finished
      </button>
    </div>
  ),
}))
```

- [ ] In the same test file, update the existing `families-step` mock (lines 78-87) so it calls `onAdvance` (the wizard now wires families to `latchNext`, not `finish`); the mock already calls `props.onAdvance()` so it is unchanged in shape. Then add resume and exit tests inside the `describe("OnboardingWizard")` block, before its closing `})` (line 418). The `OnboardingStatus` fixtures now need `hasRoles`. Add:

```tsx
  it("resumes on the score step when families is server-complete but onboarding is not", () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: true,
        hasRoles: true,
        completed: false,
      },
      fullSettings
    )
    // families.isComplete follows hasRoles (true), score.isComplete follows
    // completed (false), so the first incomplete step is the score step.
    expect(screen.getByTestId("score-step")).toBeDefined()
    expect(screen.getByTestId("score-orgid").textContent).toBe("org-1")
  })

  it("the families continue advances to the score step", async () => {
    renderWizard(
      {
        organization: admin,
        settingsComplete: true,
        hasModel: true,
        hasRoles: false,
        completed: false,
      },
      fullSettings
    )
    // hasRoles is false, so families is the frontier. Continue from model,
    // then from families, landing on the score step.
    fireEvent.click(screen.getByText("model-continue"))
    expect(await screen.findByTestId("families-step")).toBeDefined()
    fireEvent.click(screen.getByText("families-finished"))
    expect(await screen.findByTestId("score-step")).toBeDefined()
  })

  it("the score step's finish hands control back to the gate", async () => {
    const onFinished = vi.fn()
    useQueryMock.mockReturnValue(fullSettings)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <OnboardingWizard
          status={{
            organization: admin,
            settingsComplete: true,
            hasModel: true,
            hasRoles: true,
            completed: false,
          }}
          onFinished={onFinished}
        />
      </NextIntlClientProvider>
    )
    fireEvent.click(screen.getByText("score-finished"))
    expect(onFinished).toHaveBeenCalledTimes(1)
  })
```

- [ ] In the same test file, add `hasRoles: false` to every existing `OnboardingStatus` fixture (the `renderWizard(...)` calls and inline `status` objects at lines 154-159, 164-175, 178-190, 193-204, 207-218, 221-234, 237-246, 249-262, 265-288, 294-329, 332-357, 363-395, 398-417). Each `{ organization, settingsComplete, hasModel, completed }` object gains `hasRoles: false` (or `hasRoles: true` where the test intends families complete; for the pre-existing tests `false` preserves their current frontier expectations, since none of them rely on families being server-complete). For the `discarding the model` test (lines 363-395), keep `hasRoles: false` in both the initial status and the rerender.

- [ ] Run the tests to verify they fail. Command:

```
bun run test --filter @workspace/dashboard -- onboarding-wizard
```

Expected: the new tests fail because the wizard has no `score` STEP (the `score-step` test id never renders), and TypeScript/`isComplete` for `families` is still hardcoded `false` so "resumes on the score step" lands on `families-step` instead of `score-step`.

- [ ] Write the minimal implementation. In `apps/dashboard/components/onboarding/onboarding-wizard.tsx`, add `hasRoles` to the `OnboardingStatus` interface (lines 17-22):

```ts
export interface OnboardingStatus {
  organization: { orgId: string; name: string; role: string } | null
  settingsComplete: boolean
  hasModel: boolean
  hasRoles: boolean
  completed: boolean
}
```

- [ ] In the same file, change the `families` STEP so `isComplete` follows `hasRoles` (server-derived), and its `render` wires `onAdvance` to `ctx.latchNext` (so families advances to the score step rather than finishing). Replace the `families` STEP object (lines 111-123) with:

```ts
  {
    key: "families",
    dotLabelKey: "dots.families",
    // Server-derived: once the org has at least one role, families is
    // complete, so a reload mid-scoring resumes on the score step.
    isComplete: (status: OnboardingStatus) => status.hasRoles,
    render: (ctx: StepContext) =>
      ctx.status.organization === null ? null : (
        <FamiliesStep
          orgId={ctx.status.organization.orgId}
          organizationName={ctx.status.organization.name}
          onAdvance={ctx.latchNext}
        />
      ),
  },
  {
    key: "score",
    dotLabelKey: "dots.score",
    // Complete exactly when onboarding is complete: leaving the score step by
    // any path stamps onboardingCompletedAt and flips this true.
    isComplete: (status: OnboardingStatus) => status.completed,
    render: (ctx: StepContext) =>
      ctx.status.organization === null ? null : (
        <ScoreStep orgId={ctx.status.organization.orgId} onFinish={ctx.finish} />
      ),
  },
```

- [ ] In the same file, add the `ScoreStep` import alongside the other onboarding imports (near line 13):

```ts
import { ScoreStep } from "@/components/onboarding/score-step"
```

- [ ] In the same file, note the session-latch interaction: the `frontier` computation (lines 178-181) gates `sessionStep` on `status.hasModel`. Families now reaches the score step via `latchNext` (sessionStep = score index). Because `families.isComplete` follows `hasRoles`, once the starter set is created `derived` already points at the score step, so the latch and the server-derived index agree; no change to the frontier logic is needed. Confirm by re-reading lines 159-185 that `resumeIndex()` returns the score index when `hasRoles && !completed`.

- [ ] Run the tests to verify they pass. Command:

```
bun run test --filter @workspace/dashboard -- onboarding-wizard
```

Expected: all `OnboardingWizard` tests pass, including the three new ones and every updated fixture.

- [ ] Run the full dashboard onboarding suite to confirm families + score + wizard agree. Command:

```
bun run test --filter @workspace/dashboard -- onboarding
```

Expected: all onboarding tests pass (wizard, families-step, score-step, score-role).

- [ ] Commit. Commands:

```
git add apps/dashboard/components/onboarding/onboarding-wizard.tsx apps/dashboard/components/onboarding/onboarding-wizard.test.tsx
git commit -m "feat(onboarding): add the score step to the wizard

families.isComplete now follows hasRoles (server-derived) and advances
via latchNext; the new score step's isComplete follows completed, so a
reload mid-scoring resumes on the score step and finishing it hands
control back to the gate.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Backend resume integrity test (each exit path stamps `onboardingCompletedAt`)

**Files:**
- Test: `packages/backend/convex/accounts/organization.test.ts` (add a focused test that `completeOnboarding` is idempotent and stamps the timestamp, which is what every score-step exit path triggers)

The wizard-level exit paths (later / save and exit / all complete) are covered by the `ScoreStep` component tests in Task 6, which assert `completeOnboarding` is called on each. This task adds the backend backstop that the call actually stamps `onboardingCompletedAt` once (the server-derived `completed` flag the gate trusts).

- [ ] Read the existing `organization.test.ts` to match its setup pattern. Command:

```
bun run test --filter @workspace/backend -- organization
```

Expected: the existing `completeOnboarding` tests pass (this confirms the test file and helpers compile before adding to them).

- [ ] Write the failing test. In `packages/backend/convex/accounts/organization.test.ts`, inside the `describe` that covers `completeOnboarding` (locate it with `grep -n "completeOnboarding" packages/backend/convex/accounts/organization.test.ts`), add:

```ts
  it("stamps onboardingCompletedAt once and is idempotent across exit paths", async () => {
    const t = initConvexTest()
    const { orgId, userId } = await seedAdmin(t)
    const asUser = t.withIdentity({ subject: userId })

    // A model with MIN_CRITERIA criteria so the composition floor passes.
    await t.run(async (ctx) => {
      const modelId = await ctx.db.insert("models", {
        orgId,
        name: "Standard",
        bandThresholds: [],
      })
      for (let index = 0; index < 5; index++) {
        await ctx.db.insert("criteria", {
          orgId,
          modelId,
          name: `Criterion ${index + 1}`,
          description: "",
          helpText: "",
          anchors: [],
          weightPoints: 3,
          order: index + 1,
          isCustom: true,
        })
      }
    })

    // First exit (e.g. "I'll do this later"): the timestamp is stamped.
    await asUser.mutation(api.accounts.organization.completeOnboarding, { orgId })
    const firstStamp = await t.run(async (ctx) => {
      const settings = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      return settings?.onboardingCompletedAt ?? null
    })
    expect(typeof firstStamp).toBe("number")

    // A later exit (e.g. "Save and exit" after re-entry) is idempotent: the
    // original timestamp is kept.
    await asUser.mutation(api.accounts.organization.completeOnboarding, { orgId })
    const secondStamp = await t.run(async (ctx) => {
      const settings = await ctx.db
        .query("organizations")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .unique()
      return settings?.onboardingCompletedAt ?? null
    })
    expect(secondStamp).toBe(firstStamp)
  })
```

Note: if `organization.test.ts` does not already define a `seedAdmin` helper, copy the one from `onboarding.test.ts` (lines 5-11) to the top of the file, or use the existing seed helper the file already imports (check the file's top with `grep -n "seedAdmin\|seedMembership\|initConvexTest" packages/backend/convex/accounts/organization.test.ts` and reuse it). Match the `models`/`criteria` insert shape to the actual schema; adjust the inserted fields to whatever the schema in `packages/backend/convex/schema.ts` requires (omit any field the schema does not declare, add any required field it does).

- [ ] Run the test to verify it fails or passes-as-regression. Command:

```
bun run test --filter @workspace/backend -- organization
```

Expected: this asserts behavior `completeOnboarding` already has (idempotent stamping), so it should PASS immediately as a regression guard. If it fails, the failure pinpoints a real bug in the exit-path contract the score step depends on; fix `completeOnboarding` per ADR (do not weaken the `MIN_CRITERIA` floor). Treat a green result as the expected outcome here: the test documents the contract every score-step exit path relies on.

- [ ] Commit. Commands:

```
git add packages/backend/convex/accounts/organization.test.ts
git commit -m "test(onboarding): completeOnboarding stamps once across exit paths

Backstop for the score step: every exit path (later, save and exit, all
complete) calls completeOnboarding, which must stamp onboardingCompletedAt
once and stay idempotent on re-entry.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Dashboard "Continue scoring" Overview card

**Files:**
- Modify: `apps/dashboard/app/(app)/page.tsx` (the Overview page; add a query for `getResults` and render a continue-scoring card shown until all roles complete)
- Create: `apps/dashboard/app/(app)/page.test.tsx`

- [ ] Write the failing test. Create `apps/dashboard/app/(app)/page.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () =>
  (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock("@workspace/backend/convex/_generated/api", async () =>
  (await import("@/test/convex-mocks")).apiModule
)
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", name: "Acme", role: "admin" }),
}))

import OverviewPage from "@/app/(app)/page"

const t = messages.dashboard.overview.continueScoring

function results(rows: Array<{ complete: boolean }>) {
  return {
    rows: rows.map((row, index) => ({
      roleId: `role-${index}`,
      title: "Role",
      trackKey: "IC",
      trackName: "IC",
      status: "draft",
      complete: row.complete,
      ratedCount: row.complete ? 5 : 0,
      totalCriteria: 5,
      score: null,
      band: null,
      familyId: null,
      familyName: null,
    })),
    bands: [],
  }
}

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <OverviewPage />
    </NextIntlClientProvider>
  )
}

describe("OverviewPage continue-scoring card", () => {
  beforeEach(() => useQueryMock.mockReset())
  afterEach(() => cleanup())

  it("shows the card with X of Y when some roles are unscored", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults")
        return results([{ complete: true }, { complete: false }])
      if (ref === "assessment.roles.listRoles") return []
      return { criteria: [] }
    })
    renderPage()
    expect(screen.getByText(t.title)).toBeDefined()
    expect(
      screen.getByText(
        t.progress.replace("{scored}", "1").replace("{total}", "2")
      )
    ).toBeDefined()
  })

  it("hides the card when every role is complete", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults")
        return results([{ complete: true }, { complete: true }])
      if (ref === "assessment.roles.listRoles") return []
      return { criteria: [] }
    })
    renderPage()
    expect(screen.queryByText(t.title)).toBeNull()
  })

  it("hides the card when there are no roles", () => {
    useQueryMock.mockImplementation((ref: string) => {
      if (ref === "assessment.results.getResults") return results([])
      if (ref === "assessment.roles.listRoles") return []
      return { criteria: [] }
    })
    renderPage()
    expect(screen.queryByText(t.title)).toBeNull()
  })
})
```

- [ ] Run the test to verify it fails. Command:

```
bun run test --filter @workspace/dashboard -- "app/(app)/page"
```

Expected: the first test fails because the Overview page does not query `getResults` or render the continue-scoring card (`t.title` is absent). The other two pass trivially (card absent), but the suite is red overall.

- [ ] Write the minimal implementation. In `apps/dashboard/app/(app)/page.tsx`, add a `Button` import and a `getResults` query, then render the card above the cards grid when there are unscored roles. First add the import (alongside the existing imports at the top):

```ts
import { Button } from "@workspace/ui/components/button"
```

- [ ] In the same file, inside `OverviewPage`, after the existing `model` query (line 25), add the results query and derive the counts:

```ts
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  const tScoring = useTranslations("dashboard.overview.continueScoring")
  const scoredCount = results?.rows.filter((row) => row.complete).length ?? 0
  const totalRoles = results?.rows.length ?? 0
  const showContinueScoring = totalRoles > 0 && scoredCount < totalRoles
```

- [ ] In the same file, wrap the returned grid so the card renders above it when `showContinueScoring`. Replace the final `return (...)` block (lines 72-101) with:

```tsx
  return (
    <div className="space-y-4">
      {showContinueScoring && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{tScoring("title")}</CardTitle>
            <CardDescription>
              {tScoring("progress", { scored: scoredCount, total: totalRoles })}
            </CardDescription>
            <Button asChild className="mt-2 self-start">
              <Link href="/roles">{tScoring("cta")}</Link>
            </Button>
          </CardHeader>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.key}>
            <CardHeader>
              {/* The help morph sits OUTSIDE CardDescription (a <p>): the
                  popover renders a div, which is invalid inside a paragraph. */}
              <div className="flex items-center gap-1.5">
                <CardDescription>{card.label}</CardDescription>
                {card.help !== undefined && (
                  <HelpMorphButton label={card.help.label}>
                    {card.help.body}
                  </HelpMorphButton>
                )}
              </div>
              {/* Counts are neutral values, not identity: keep ink, not brand. */}
              <CardTitle className="text-3xl text-foreground tabular-nums">
                {loading ? <Skeleton className="h-9 w-12" /> : card.value}
              </CardTitle>
              <Link
                href={card.href}
                className="text-muted-foreground text-sm underline-offset-4 hover:underline"
              >
                {card.linkLabel}
              </Link>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
```

- [ ] Note the existing `CardTitle` import: the file currently imports `Card, CardDescription, CardHeader, CardTitle` from `@workspace/ui/components/card` (lines 4-9). `CardTitle` is already imported, so no import change is needed there. Verify the import block already contains `CardTitle` (it does, line 8). The `cards`/`loading`/`HelpMorphButton`/`Skeleton`/`Link` references in the replacement block are the file's existing identifiers, copied verbatim from the original return; do not rename them.

- [ ] Run the test to verify it passes. Command:

```
bun run test --filter @workspace/dashboard -- "app/(app)/page"
```

Expected: all three `OverviewPage continue-scoring card` tests pass.

- [ ] Commit. Commands:

```
git add "apps/dashboard/app/(app)/page.tsx" "apps/dashboard/app/(app)/page.test.tsx"
git commit -m "feat(overview): continue-scoring card on the dashboard

A card 'Continue scoring, X of Y roles scored' shown until every role is
complete, linking to /roles where the per-role resume CTAs live. X/Y are
derived from assessment.results.getResults (the complete flag); no new
backend query.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Full verification (the pre-commit hook gates)

**Files:**
- No new files. Runs the same checks the pre-commit hook runs.

- [ ] Run Biome on the changed files (the hook runs it on staged files; run it across the touched directories). Command (run from the repo root):

```
bunx biome check apps/dashboard/components/onboarding apps/dashboard/app packages/backend/convex/accounts packages/i18n/messages
```

Expected: no diagnostics. Do not reformat any shadcn vendor code under `packages/ui/src/*` (none touched here).

- [ ] Run the full typecheck (the hook runs it across the monorepo). Command:

```
bun run typecheck
```

Expected: passes. The `OnboardingStatus` fixtures, the new `score` STEP, the `getResults` query usage, and the `ScoreStep`/`ScoreRole` props all typecheck against the generated Convex API (regenerated in Task 2).

- [ ] Run the full test suite (the hook runs `turbo run test`, cache-backed). Command:

```
bun run test
```

Expected: all packages pass, including `@workspace/backend` (onboarding + organization), `@workspace/i18n` (parity), and `@workspace/dashboard` (onboarding-wizard, families-step, score-step, score-role, overview page).

- [ ] If everything is green, confirm there is nothing uncommitted. Command:

```
git status --porcelain
```

Expected: clean (every change was committed in its own task). If Biome made formatting fixes that are still unstaged, commit them:

```
git add -A
git commit -m "chore(onboarding): biome formatting for the score step

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done when

- [ ] `getOnboardingStatus` returns `hasRoles` (true once the org has at least one role); backend test green.
- [ ] `families-step` no longer calls `completeOnboarding`; it creates the starter set and advances via the wizard's `latchNext`; tests assert `completeOnboarding` is not called from families.
- [ ] The wizard's `families.isComplete` follows `hasRoles` (server-derived) and the new `score` step's `isComplete` follows `completed`; reload mid-scoring resumes on the score step; finishing it hands control back to the gate.
- [ ] `completeOnboarding` (unchanged signature, still enforces `MIN_CRITERIA`) fires from the score step on every exit path: "I'll do this later", "Save and exit", and "all roles complete"; the idempotent-stamp backstop test is green.
- [ ] `score-step.tsx` shows the fork only when no role is started (derived from any role having a rating or being complete, since `getResults` exposes no profile field; the profile-only case is intentionally not counted), shows the scoring list with the persistent save-and-exit line and button otherwise, and shows the done state when all roles are complete; component tests cover all phases.
- [ ] `score-role.tsx` opens to inline profile capture (the two fields + `RoleAiPanel`) when the profile is empty, then the blind `RatingStepper` (auto-saves per criterion), then the `RatingResult` reveal, then back to the list; the AI panel's open state lives at the top level and renders via a plain helper (not a nested component), so typing in the capture fields never remounts it; `RatingStepper`, `RatingResult`, and `RoleAiPanel` are reused unchanged.
- [ ] The Overview page shows a "Continue scoring, X of Y roles scored" card until all roles complete, linking to `/roles`, with X/Y derived from `assessment.results.getResults`; `role-rating-card.tsx` is unchanged.
- [ ] New i18n keys exist in all five locales (`dashboard.onboarding.dots.score`, `dashboard.onboarding.score.*`, `dashboard.help.onboardingScore{Label,Body}`, `dashboard.overview.continueScoring.*`); the i18n parity test is green; no em dashes in any copy.
- [ ] Audit is unchanged (`setRating` and `completeOnboarding` already audit); no new `AUDIT_EVENTS` keys were added.
- [ ] `docs/ui-animation.md` was read before any animation work; the score step uses only the wizard's opacity crossfade in a fixed frame and respects the global `MotionConfig reducedMotion="user"`.
- [ ] Biome, `bun run typecheck`, and `bun run test` all pass (the three pre-commit gates).
