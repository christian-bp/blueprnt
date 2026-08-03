# In-app AI Role Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen wizard at `/roles/import` that turns a pasted role list into role families and roles via AI, purely additively, and drafts job profiles for exactly what it created.

**Architecture:** Three shared units are extracted from the onboarding families step first (behaviour-preserving), then an additive backend confirm path is added beside the existing starter-set one, then the wizard composes both. Family identity and duplicate detection are derived by one pure function so the review screen and the submitted payload can never disagree.

**Tech Stack:** Next.js 16 App Router, React 19, Convex (eu-west-1), next-intl, Motion, dnd-kit, Zod, Vitest 4, Biome.

**Spec:** `docs/superpowers/specs/2026-08-01-in-app-ai-role-import-design.md`

## Global Constraints

- **All tests run with Vitest 4.** Never `bun test`. Always `bun run test`.
- **Never use em dashes** in any text: UI copy, comments, commit messages, docs.
- **All user-facing text goes through i18n**, added to `packages/i18n/messages/en.json` first, then mirrored to `sv`, `nb`, `da`, `fi`. The parity test fails on a key present in one file and missing in another.
- **Never add non-ASCII locale strings via shell `perl`/`sed`** (it double-encodes). Use the Write/Edit tools only, then grep for mojibake.
- **`packages/ui/src/*` is vendor code.** Do not modify or reformat it.
- **Every state-changing mutation writes an audit row** via `logAudit` / `ctx.audit.log` with an `AUDIT_EVENTS` key.
- **`packages/core` purity is not involved here.** No changes to it.
- **Never send personal data to the AI.** Only role-level and organization-level content. Family names qualify; no person data appears anywhere in this feature.
- **No `any`.** Do not widen a type to silence an error.
- **Leave work uncommitted for review at the end of each task's commit step only.** Commit on `main`, do not push.
- **Lint/format is Biome**, run by the pre-commit hook along with a full typecheck and `turbo run test`. All three must pass. Never `--no-verify`.

**Preflight (do once, before Task 1):** the working tree already carries unrelated cosmetic changes to `apps/dashboard/components/onboarding/families-step.tsx`, `name-screen.tsx`, `families-step.test.tsx` and the five message files. Commit those first so the refactor diff stays readable:

```bash
git add apps/dashboard/components/onboarding/families-step.tsx \
        apps/dashboard/components/onboarding/families-step.test.tsx \
        apps/dashboard/components/onboarding/name-screen.tsx \
        packages/i18n/messages/*.json
git commit -m "style(onboarding): left-align the families step and describe its field"
```

---

## Phase A: behaviour-preserving refactor

The contract for this whole phase: **all 32 existing tests in `apps/dashboard/components/onboarding/families-step.test.tsx` pass unchanged.** If a test needs editing, the refactor changed behaviour and is wrong (the only permitted edits are import paths and `vi.mock` paths).

### Task 1: Move `FamiliesReview` to the components root

The review is about to gain a second consumer in `components/roles/`, and the file-ownership rule puts a shared component at the components root. It has no direct test today, so it gets one.

**Files:**
- Move: `apps/dashboard/components/onboarding/families-review.tsx` to `apps/dashboard/components/families-review.tsx`
- Modify: `apps/dashboard/components/onboarding/families-step.tsx:15`
- Create: `apps/dashboard/components/families-review.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `FamiliesReview` importable from `@/components/families-review`, with its existing props unchanged: `{ families: DraftFamily[]; onFamiliesChange: (updater: (current: DraftFamily[]) => DraftFamily[]) => void; claimId: () => number; trackOptions: { trackKey: string; label: string }[] }`.

- [ ] **Step 1: Move the file**

```bash
git mv apps/dashboard/components/onboarding/families-review.tsx \
       apps/dashboard/components/families-review.tsx
```

- [ ] **Step 2: Update the single import**

In `apps/dashboard/components/onboarding/families-step.tsx`, change:

```tsx
import { FamiliesReview } from "@/components/onboarding/families-review"
```

to:

```tsx
import { FamiliesReview } from "@/components/families-review"
```

Biome sorts imports, so this line moves up with the other `@/components/*` entries. Run `bunx biome check --write apps/dashboard/components/onboarding/families-step.tsx` to place it.

- [ ] **Step 3: Write the failing test**

Create `apps/dashboard/components/families-review.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { useRef, useState } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { FamiliesReview } from "@/components/families-review"
import type { DraftFamily } from "@/lib/family-dnd"

const t = messages.dashboard.onboarding.families
const familyLabel = messages.dashboard.roles.family.nameLabel
const titleLabel = messages.dashboard.roles.create.titleLabel

const TRACKS = [
  { trackKey: "IC", label: "Individual Contributor" },
  { trackKey: "Lead", label: "Lead" },
]

// Controlled harness: FamiliesReview is a pure view over a families array plus
// an updater, so the test owns the state exactly like the real callers do.
function Harness({ initial }: { initial: DraftFamily[] }) {
  const [families, setFamilies] = useState(initial)
  const nextId = useRef(100)
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamiliesReview
        families={families}
        onFamiliesChange={(updater) =>
          setFamilies((current) => updater(current))
        }
        claimId={() => {
          const id = nextId.current
          nextId.current += 1
          return id
        }}
        trackOptions={TRACKS}
      />
    </NextIntlClientProvider>
  )
}

function twoFamilies(): DraftFamily[] {
  return [
    {
      id: 1,
      name: "Engineering",
      roles: [
        { id: 2, title: "Developer", trackKey: "IC" },
        { id: 3, title: "Tech Lead", trackKey: "Lead" },
      ],
    },
    { id: 4, name: "Sales", roles: [{ id: 5, title: "AE", trackKey: "IC" }] },
  ]
}

describe("FamiliesReview", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders an editable name per family and a title input per role", () => {
    render(<Harness initial={twoFamilies()} />)
    expect(
      screen.getAllByLabelText(familyLabel).map((el) => (el as HTMLInputElement).value)
    ).toEqual(["Engineering", "Sales"])
    expect(
      screen.getAllByLabelText(titleLabel).map((el) => (el as HTMLInputElement).value)
    ).toEqual(["Developer", "Tech Lead", "AE"])
  })

  it("edits a family name through the updater", () => {
    render(<Harness initial={twoFamilies()} />)
    const [first] = screen.getAllByLabelText(familyLabel)
    if (first === undefined) throw new Error("no family input")
    fireEvent.change(first, { target: { value: "Platform" } })
    expect((first as HTMLInputElement).value).toBe("Platform")
  })

  it("appends an empty role to the family whose add row was clicked", () => {
    render(<Harness initial={twoFamilies()} />)
    const addRows = screen.getAllByRole("button", { name: t.addRoleCta })
    const second = addRows[1]
    if (second === undefined) throw new Error("no add row")
    fireEvent.click(second)
    const titles = screen
      .getAllByLabelText(titleLabel)
      .map((el) => (el as HTMLInputElement).value)
    expect(titles).toEqual(["Developer", "Tech Lead", "AE", ""])
  })

  it("appends an empty family", () => {
    render(<Harness initial={twoFamilies()} />)
    fireEvent.click(screen.getByRole("button", { name: t.addFamilyCta }))
    expect(screen.getAllByLabelText(familyLabel)).toHaveLength(3)
  })

  it("renders a drag handle per role", () => {
    render(<Harness initial={twoFamilies()} />)
    expect(
      screen.getByLabelText(t.dragHandleLabel.replace("{title}", "Developer"))
    ).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=dashboard -- families-review`
Expected: 5 passing. If `dragHandleLabel` interpolation differs from `{title}`, read the real value in `packages/i18n/messages/en.json` under `dashboard.onboarding.families.dragHandleLabel` and adjust the replace call.

- [ ] **Step 5: Run the onboarding suite to prove nothing moved**

Run: `bun run test --filter=dashboard -- families-step`
Expected: 32 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/families-review.tsx \
        apps/dashboard/components/families-review.test.tsx \
        apps/dashboard/components/onboarding/families-step.tsx
git commit -m "refactor(roles): move the families review to the shared components root"
```

---

### Task 2: Extract `PastedRolesField`

The paste block (label, help popover, textarea with the animated placeholder, hint) is about to be rendered by two surfaces with different copy. `TypewriterPlaceholder` gains the same second consumer, so it moves too.

**Files:**
- Move: `apps/dashboard/components/onboarding/typewriter-placeholder.tsx` to `apps/dashboard/components/typewriter-placeholder.tsx`
- Move: `apps/dashboard/components/onboarding/typewriter-placeholder.test.tsx` to `apps/dashboard/components/typewriter-placeholder.test.tsx`
- Create: `apps/dashboard/components/pasted-roles-field.tsx`
- Modify: `apps/dashboard/components/onboarding/families-step.tsx` (replace the inline block)
- Modify: `apps/dashboard/components/onboarding/families-step.test.tsx` (the `vi.mock` path only)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `PastedRolesField` from `@/components/pasted-roles-field` with props `{ id: string; value: string; onChange: (value: string) => void; label: string; helpLabel: string; helpBody: string; hint: string; placeholderPhrases: string[] }`.

- [ ] **Step 1: Move the placeholder component and its test**

```bash
git mv apps/dashboard/components/onboarding/typewriter-placeholder.tsx \
       apps/dashboard/components/typewriter-placeholder.tsx
git mv apps/dashboard/components/onboarding/typewriter-placeholder.test.tsx \
       apps/dashboard/components/typewriter-placeholder.test.tsx
```

Then update the import inside `apps/dashboard/components/typewriter-placeholder.test.tsx` from `@/components/onboarding/typewriter-placeholder` to `@/components/typewriter-placeholder`.

- [ ] **Step 2: Create the shared field**

Create `apps/dashboard/components/pasted-roles-field.tsx`:

```tsx
"use client"

import { MAX_STARTER_IMPORT_TEXT } from "@workspace/constants"
import { Label } from "@workspace/ui/components/label"
import { Textarea } from "@workspace/ui/components/textarea"
import { HelpMorphButton } from "@/components/help-morph-button"
import { TypewriterPlaceholder } from "@/components/typewriter-placeholder"

// The paste-your-roles field, shared by the onboarding families step and the
// in-app role import. All copy is injected: the two surfaces address different
// situations (a first-run org versus one that already has a register), so they
// keep their own i18n keys while sharing the markup and the input cap.
//
// The field and its hint are one block (tighter than the surrounding section),
// so the hint reads as belonging to the textarea. Styled like the design
// system's FormDescription; this input is not a react-hook-form field, so the
// describedby link is wired by hand.
export function PastedRolesField({
  id,
  value,
  onChange,
  label,
  helpLabel,
  helpBody,
  hint,
  placeholderPhrases,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  label: string
  helpLabel: string
  helpBody: string
  hint: string
  placeholderPhrases: string[]
}) {
  const hintId = `${id}-hint`
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <HelpMorphButton label={helpLabel}>{helpBody}</HelpMorphButton>
      </div>
      <div className="space-y-1.5">
        <div className="relative">
          <Textarea
            id={id}
            aria-describedby={hintId}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="min-h-40"
            maxLength={MAX_STARTER_IMPORT_TEXT}
          />
          {value === "" && (
            <TypewriterPlaceholder phrases={placeholderPhrases} />
          )}
        </div>
        <p id={hintId} className="text-muted-foreground text-sm">
          {hint}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Use it in the onboarding paste phase**

In `apps/dashboard/components/onboarding/families-step.tsx`, replace the whole contents of `renderPastePhase`'s outer `<div className="w-full space-y-3">` down to (but not including) the `<WizardFooter>` with the shared field. The function becomes:

```tsx
  function renderPastePhase() {
    return (
      <div className="w-full space-y-3">
        {/* No subtitle here (the review and prefill phases carry their own):
            the heading is a question, so it already says what this screen wants,
            and a paragraph repeating it read as a wall of text above the field. */}
        <PastedRolesField
          id="families-import-text"
          value={rawText}
          onChange={setRawText}
          label={t("pasteLabel")}
          helpLabel={t("pasteHelpLabel")}
          helpBody={t("pasteHelpBody")}
          hint={t("pasteHint")}
          placeholderPhrases={[
            t("placeholderPhrase1"),
            t("placeholderPhrase2"),
            t("placeholderPhrase3"),
          ]}
        />
        {/* The template CTA is the other way to leave this screen, so it sits
            in the footer immediately left of Next as the outline secondary to
            its primary (the footer convention), and carries the same forward
            arrow with the same hover nudge: two ways forward, one visual
            language. */}
        <WizardFooter>
          <Button
            type="button"
            variant="outline"
            className="group/template"
            disabled={!starterReady || !modelReady}
            onClick={seedFromTemplate}
          >
            {t("templateCta")}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              aria-hidden="true"
              className="transition-transform group-hover/template:translate-x-0.5 group-focus-visible/template:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover/template:translate-x-0"
            />
          </Button>
          <NextButton
            disabled={requestPending || !inputValid}
            onClick={() => onAnalyze()}
          />
        </WizardFooter>
        {/* Alerts extend below the CTA so nothing on screen reflows. A failed
            template create (which runs on pick) drops back here, so its
            duplicate/generic failure surfaces in the paste view alongside the
            AI-import failures. */}
        {(flow.status === "failed" || requestFailed || failure !== null) && (
          <p role="alert" className="text-destructive text-sm">
            {failure === "duplicate"
              ? tErrors("roleFamilyExists")
              : failure === "generic" || requestFailed
                ? t("error")
                : tErrors(flow.errorSubKey ?? "aiGenerationFailed")}
          </p>
        )}
      </div>
    )
  }
```

Add `import { PastedRolesField } from "@/components/pasted-roles-field"` and delete the now-unused imports: `Label`, `Textarea`, `MAX_STARTER_IMPORT_TEXT`, `TypewriterPlaceholder`, and `HelpMorphButton` **only if** the review phase no longer uses it (it does use it, so keep `HelpMorphButton`).

- [ ] **Step 4: Fix the mock path in the onboarding test**

In `apps/dashboard/components/onboarding/families-step.test.tsx`, change:

```tsx
vi.mock("@/components/onboarding/typewriter-placeholder", () => ({
  TypewriterPlaceholder: () => null,
}))
```

to:

```tsx
vi.mock("@/components/typewriter-placeholder", () => ({
  TypewriterPlaceholder: () => null,
}))
```

This is the one permitted test edit in Phase A: the module moved, so the mock target moved with it.

- [ ] **Step 5: Run the suites**

Run: `bun run test --filter=dashboard -- families-step typewriter`
Expected: the 32 onboarding tests plus the placeholder's own tests all pass. In particular `describes the field with a visible format hint` and `starts in the paste view with a disabled next button` must still pass, which is what proves the extraction preserved the markup.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/pasted-roles-field.tsx \
        apps/dashboard/components/typewriter-placeholder.tsx \
        apps/dashboard/components/typewriter-placeholder.test.tsx \
        apps/dashboard/components/onboarding/families-step.tsx \
        apps/dashboard/components/onboarding/families-step.test.tsx
git commit -m "refactor(roles): extract the shared pasted-roles field"
```

---

### Task 3: Extract `useProfilePrefill`

The prefill span (the flag that drives the dedicated screen, the single best-effort retry on a partial failure, and the progress derivation) is identical in both flows apart from the scope.

**Files:**
- Create: `apps/dashboard/hooks/use-profile-prefill.ts`
- Create: `apps/dashboard/hooks/use-profile-prefill.test.tsx`
- Modify: `apps/dashboard/hooks/use-families-draft-flow.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `useProfilePrefill({ orgId: string }): { prefilling: boolean; run: (args: { locale: string; willPrefill: boolean; roleIds?: Id<"roles">[] }) => Promise<void> }`
  - `prefillProgressOf(roles: { roleId: Id<"roles">; profileComplete: boolean }[] | undefined, scopeIds?: Id<"roles">[]): { done: number; total: number }`

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/hooks/use-profile-prefill.test.tsx`:

```tsx
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockAction } from "@/test/convex-mocks"

const prefillMock = mockAction("ai.prefill.prefillRoleProfiles")

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import {
  prefillProgressOf,
  useProfilePrefill,
} from "@/hooks/use-profile-prefill"

type Hook = ReturnType<typeof useProfilePrefill>

function renderHook() {
  const captured: { current: Hook | null } = { current: null }
  function Probe() {
    captured.current = useProfilePrefill({ orgId: "org-1" })
    return null
  }
  render(<Probe />)
  return captured
}

describe("prefillProgressOf", () => {
  const roles = [
    { roleId: "r1" as never, profileComplete: true },
    { roleId: "r2" as never, profileComplete: false },
    { roleId: "r3" as never, profileComplete: true },
  ]

  it("measures every role when no scope is given", () => {
    expect(prefillProgressOf(roles)).toEqual({ done: 2, total: 3 })
  })

  it("measures only the scoped roles", () => {
    expect(prefillProgressOf(roles, ["r2" as never, "r3" as never])).toEqual({
      done: 1,
      total: 2,
    })
  })

  it("counts a scoped role the query has not reported yet toward the total", () => {
    expect(prefillProgressOf(roles, ["r3" as never, "r9" as never])).toEqual({
      done: 1,
      total: 2,
    })
  })

  it("treats a still-loading role list as zero done", () => {
    expect(prefillProgressOf(undefined)).toEqual({ done: 0, total: 0 })
  })
})

describe("useProfilePrefill", () => {
  beforeEach(() => {
    prefillMock.mockReset()
    prefillMock.mockResolvedValue({ generated: 0, failed: 0 })
  })

  afterEach(() => {
    cleanup()
  })

  it("passes the role scope through to the action", async () => {
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({
        locale: "sv",
        willPrefill: true,
        roleIds: ["r1" as never, "r2" as never],
      })
    })
    expect(prefillMock).toHaveBeenCalledWith({
      orgId: "org-1",
      locale: "sv",
      roleIds: ["r1", "r2"],
    })
  })

  it("omits the scope key entirely when no roleIds are given", async () => {
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: true })
    })
    expect(prefillMock).toHaveBeenCalledWith({ orgId: "org-1", locale: "sv" })
  })

  it("raises the prefilling flag only when the caller expects work", async () => {
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: false })
    })
    expect(hook.current?.prefilling).toBe(false)
  })

  it("retries once when a batch partially failed", async () => {
    prefillMock.mockResolvedValueOnce({ generated: 3, failed: 2 })
    prefillMock.mockResolvedValueOnce({ generated: 2, failed: 0 })
    const hook = renderHook()
    await act(async () => {
      await hook.current?.run({ locale: "sv", willPrefill: true })
    })
    expect(prefillMock).toHaveBeenCalledTimes(2)
  })

  it("swallows a failed retry", async () => {
    prefillMock.mockResolvedValueOnce({ generated: 1, failed: 1 })
    prefillMock.mockRejectedValueOnce(new Error("rate limited"))
    const hook = renderHook()
    await act(async () => {
      await expect(
        hook.current?.run({ locale: "sv", willPrefill: true })
      ).resolves.toBeUndefined()
    })
  })

  it("clears the flag and rethrows when the first call hard-rejects", async () => {
    prefillMock.mockRejectedValueOnce(new Error("boom"))
    const hook = renderHook()
    await act(async () => {
      await expect(
        hook.current?.run({ locale: "sv", willPrefill: true })
      ).rejects.toThrow("boom")
    })
    expect(hook.current?.prefilling).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=dashboard -- use-profile-prefill`
Expected: FAIL, cannot resolve `@/hooks/use-profile-prefill`.

- [ ] **Step 3: Write the hook**

Create `apps/dashboard/hooks/use-profile-prefill.ts`:

```ts
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useAction } from "convex/react"
import { useState } from "react"

export interface PrefillProgress {
  done: number
  total: number
}

// Live prefill progress derived from listRoles: how many of the measured roles
// already report a complete profile. As each prefill chunk's applyPrefill
// commits, listRoles re-runs and `done` climbs, so a progress bar advances
// reactively with no extra backend plumbing.
//
// `scopeIds` narrows the measurement to one import's roles. The total then
// comes from the scope rather than from the reported roles, so a role the
// query has not caught up with yet still counts toward the denominator instead
// of making the bar jump.
export function prefillProgressOf(
  roles: { roleId: Id<"roles">; profileComplete: boolean }[] | undefined,
  scopeIds?: Id<"roles">[]
): PrefillProgress {
  const all = roles ?? []
  if (scopeIds === undefined) {
    return {
      total: all.length,
      done: all.filter((role) => role.profileComplete).length,
    }
  }
  const scope = new Set<string>(scopeIds.map((id) => id as string))
  return {
    total: scopeIds.length,
    done: all.filter(
      (role) => scope.has(role.roleId as string) && role.profileComplete
    ).length,
  }
}

export interface ProfilePrefill {
  // True across the prefill await, and only when the caller said there was
  // something to draft. Drives the dedicated prefilling screen. Deliberately
  // NOT cleared on success: onboarding navigates away from the screen, and the
  // in-app wizard gates its own phase on its `pending` flag instead, so
  // clearing here would flash the previous screen for one render.
  prefilling: boolean
  // Runs the prefill plus one best-effort retry when a batch partially failed.
  // Resolves on success and on a swallowed retry failure; rejects only on a
  // hard/transport error, after clearing `prefilling` so the caller returns to
  // its own screen with an error.
  run: (args: {
    locale: string
    willPrefill: boolean
    roleIds?: Id<"roles">[]
  }) => Promise<void>
}

// The shared post-persist prefill span. The action itself skips roles that
// already have a profile, so an unchanged set costs no model call; `roleIds`
// narrows it further to exactly the roles one import created, so an in-app
// import never drafts profiles for unrelated empty roles.
export function useProfilePrefill(options: { orgId: string }): ProfilePrefill {
  const { orgId } = options
  const prefillRoleProfiles = useAction(api.ai.prefill.prefillRoleProfiles)
  const [prefilling, setPrefilling] = useState(false)

  return {
    prefilling,
    run: async ({ locale, willPrefill, roleIds }) => {
      if (willPrefill) setPrefilling(true)
      const args = {
        orgId,
        locale,
        ...(roleIds !== undefined ? { roleIds } : {}),
      }
      let failed: number
      try {
        const result = await prefillRoleProfiles(args)
        failed = result.failed
      } catch (error) {
        setPrefilling(false)
        throw error
      }
      // A partial failure (one batched call hit a rate limit or timeout) leaves
      // some roles empty but does not throw. One best-effort retry: the action
      // re-targets only the still-empty roles, so nothing already generated is
      // regenerated. A second miss must not block the caller, so this is
      // swallowed and the manual per-role draft stays the final fallback.
      if (failed > 0) {
        try {
          await prefillRoleProfiles(args)
        } catch {
          // Best effort only.
        }
      }
    },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=dashboard -- use-profile-prefill`
Expected: 10 passing.

- [ ] **Step 5: Use it in the onboarding flow**

In `apps/dashboard/hooks/use-families-draft-flow.ts`:

Delete the `useAction` import usage for prefill and the `prefilling` state, replacing them. Remove these lines:

```ts
  const prefillRoleProfiles = useAction(api.ai.prefill.prefillRoleProfiles)
```

```ts
  const [prefilling, setPrefilling] = useState(false)
```

Add, next to the other hook calls:

```ts
  // The shared post-persist prefill span (flag, single retry, hard-reject
  // handling). Onboarding passes no roleIds: every empty-profile role in a
  // just-created org is in scope.
  const prefill = useProfilePrefill({ orgId })
```

with `import { prefillProgressOf, useProfilePrefill } from "@/hooks/use-profile-prefill"`.

In `finish()`, replace the prefill block:

```ts
      const willPrefill =
        seededFrom?.source === "ai"
          ? (draft.families ?? []).some((family) => family.roles.length > 0)
          : (existingRoles ?? []).some((role) => !role.profileComplete)
      if (willPrefill) setPrefilling(true)
      const { failed } = await prefillRoleProfiles({ orgId, locale })
      if (failed > 0) {
        try {
          await prefillRoleProfiles({ orgId, locale })
        } catch {
          // Best effort only: advancing with a few empty profiles is fine.
        }
      }
      onAdvance()
```

with:

```ts
      // Whether prefill will have anything to draft, decided up front
      // (existingRoles is the stale render-closure value on the AI path, where
      // confirmStarterImport creates the new empty roles during finish()). The
      // AI import always produces brand-new roles with empty profiles; the
      // template/revisit paths reuse existing roles, so only show the screen
      // when some stored role still lacks a profile.
      const willPrefill =
        seededFrom?.source === "ai"
          ? (draft.families ?? []).some((family) => family.roles.length > 0)
          : (existingRoles ?? []).some((role) => !role.profileComplete)
      await prefill.run({ locale, willPrefill })
      // Onboarding is NOT completed here: the score step owns completion on
      // every exit path. This step only creates the starter set and advances.
      onAdvance()
```

In the `catch` of `finish()`, replace `setPrefilling(false)` with nothing: `prefill.run` already clears the flag before rethrowing. The catch becomes:

```ts
    } catch (error) {
      // reconcile can throw roleFamilyExists (duplicate) / roleLocked /
      // invalidInput; map the duplicate to the existing duplicate message and
      // everything else to the generic one, exactly like the create paths. A
      // hard prefill reject lands here too and shows the generic error; the
      // prefill hook has already dropped its own screen flag.
      setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      setPending(false)
    }
```

Replace the phase derivation's `prefilling` reference:

```ts
  const phase: FamiliesDraftPhase = prefill.prefilling
    ? "prefilling"
    : inReview
      ? "review"
      : flow.status === "generating"
        ? "generating"
        : "paste"
```

Replace the progress derivation:

```ts
  // Live prefill progress from listRoles, unscoped: during onboarding every
  // role in the org belongs to the set being created.
  const prefillProgress = prefillProgressOf(existingRoles)
```

- [ ] **Step 6: Run the onboarding suite**

Run: `bun run test --filter=dashboard -- families-step`
Expected: 32 passing. The six prefill tests (`prefills role profiles after reconcile...` through `advances even when the best-effort prefill retry rejects`) are the ones that prove this extraction.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/hooks/use-profile-prefill.ts \
        apps/dashboard/hooks/use-profile-prefill.test.tsx \
        apps/dashboard/hooks/use-families-draft-flow.ts
git commit -m "refactor(roles): extract the shared profile prefill span"
```

---

### Task 4: Extract `usePastedRoleDraft`

The paste to AI to editable-draft engine. This is the delicate one: the AI seed runs as adjust-state-during-render, and in onboarding it must never win over the resume-from-existing seed or hijack an in-flight template create. That guard becomes an explicit `canSeed` input.

**Files:**
- Create: `apps/dashboard/hooks/use-pasted-role-draft.ts`
- Create: `apps/dashboard/hooks/use-pasted-role-draft.test.tsx`
- Modify: `apps/dashboard/hooks/use-families-draft-flow.ts`

**Interfaces:**
- Consumes: `useProfilePrefill` and `prefillProgressOf` from Task 3.
- Produces: `usePastedRoleDraft(options): PastedRoleDraft` from `@/hooks/use-pasted-role-draft`, where

```ts
options: {
  orgId: string
  locale: string
  kind: SuggestionKind
  request: (args: { orgId: string; rawText: string; locale: string }) => Promise<unknown>
  tracks: { key: string; name: string }[] | undefined
  canSeed: boolean
}

PastedRoleDraft: {
  rawText: string
  setRawText: (value: string) => void
  inputValid: boolean
  requestPending: boolean
  requestFailed: boolean
  flow: SuggestionFlow<StarterImportValue>
  draft: ReturnType<typeof useDraftFamilies>
  trackOptions: { trackKey: string; label: string }[]
  seededSuggestionId: Id<"suggestions"> | null
  analyze: () => Promise<void>
  dismiss: () => void
}
```

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/hooks/use-pasted-role-draft.test.tsx`:

```tsx
import { act, cleanup, render } from "@testing-library/react"
import { SUGGESTION_KINDS } from "@workspace/constants"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockMutation, onQuery } from "@/test/convex-mocks"

const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})

import { usePastedRoleDraft } from "@/hooks/use-pasted-role-draft"

const TRACKS = [
  { key: "IC", name: "Individual Contributor" },
  { key: "Lead", name: "Lead" },
]

function suggestedRow() {
  return {
    suggestionId: "sugg-1",
    kind: "role.import",
    status: "suggested",
    suggestedValue: {
      families: [
        {
          name: "Engineering",
          roles: [
            { title: "Developer", trackKey: "IC" },
            // An unknown key must be coerced to the first track.
            { title: "Tech Lead", trackKey: "Boss" },
          ],
        },
      ],
    },
    errorCode: null,
    createdAt: 1,
    roleId: null,
  }
}

type Hook = ReturnType<typeof usePastedRoleDraft>

type RequestFn = (args: {
  orgId: string
  rawText: string
  locale: string
}) => Promise<unknown>

function renderHook(options: {
  canSeed?: boolean
  // Distinguishes "not passed" (use TRACKS) from an explicit undefined, which
  // is the still-loading case the seed must wait for.
  tracks?: typeof TRACKS | undefined
  request?: RequestFn
}) {
  const captured: { current: Hook | null } = { current: null }
  const request: RequestFn = options.request ?? (() => Promise.resolve(null))
  const tracks = "tracks" in options ? options.tracks : TRACKS
  function Probe() {
    captured.current = usePastedRoleDraft({
      orgId: "org-1",
      locale: "sv",
      kind: SUGGESTION_KINDS.roleImport,
      request,
      tracks,
      canSeed: options.canSeed ?? true,
    })
    return null
  }
  const view = render(<Probe />)
  return { captured, view }
}

describe("usePastedRoleDraft", () => {
  beforeEach(() => {
    rejectSuggestionMock.mockReset()
    rejectSuggestionMock.mockResolvedValue(null)
    useQueryMock.mockReset()
    useQueryMock.mockReturnValue([])
  })

  afterEach(() => {
    cleanup()
  })

  it("gates the analyze CTA on the shared input schema", () => {
    const { captured, view } = renderHook({})
    expect(captured.current?.inputValid).toBe(false)
    act(() => captured.current?.setRawText("   \n  "))
    expect(captured.current?.inputValid).toBe(false)
    act(() => captured.current?.setRawText("Developer"))
    expect(captured.current?.inputValid).toBe(true)
    act(() => captured.current?.setRawText("x".repeat(20_001)))
    expect(captured.current?.inputValid).toBe(false)
    view.unmount()
  })

  it("sends the trimmed text to the injected request", async () => {
    const request = vi.fn().mockResolvedValue(null)
    const { captured } = renderHook({ request })
    act(() => captured.current?.setRawText("  Developer\nTech Lead  "))
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(request).toHaveBeenCalledWith({
      orgId: "org-1",
      rawText: "Developer\nTech Lead",
      locale: "sv",
    })
  })

  it("does not call the request when the input is invalid", async () => {
    const request = vi.fn().mockResolvedValue(null)
    const { captured } = renderHook({ request })
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(request).not.toHaveBeenCalled()
  })

  it("flags a failed request without losing the pasted text", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"))
    const { captured } = renderHook({ request })
    act(() => captured.current?.setRawText("Developer"))
    await act(async () => {
      await captured.current?.analyze()
    })
    expect(captured.current?.requestFailed).toBe(true)
    expect(captured.current?.rawText).toBe("Developer")
  })

  it("seeds the draft from a suggested proposal and coerces unknown tracks", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({})
    expect(captured.current?.seededSuggestionId).toBe("sugg-1")
    expect(captured.current?.draft.families).toEqual([
      {
        id: 0,
        name: "Engineering",
        roles: [
          { id: 1, title: "Developer", trackKey: "IC" },
          { id: 2, title: "Tech Lead", trackKey: "IC" },
        ],
      },
    ])
  })

  it("does not seed while canSeed is false", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({ canSeed: false })
    expect(captured.current?.seededSuggestionId).toBeNull()
    expect(captured.current?.draft.families).toBeNull()
  })

  it("does not seed before the tracks have loaded", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({ tracks: undefined })
    expect(captured.current?.seededSuggestionId).toBeNull()
  })

  it("dismiss rejects the proposal, clears the draft, and blocks a re-seed", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({})
    expect(captured.current?.seededSuggestionId).toBe("sugg-1")
    act(() => captured.current?.dismiss())
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
    expect(captured.current?.seededSuggestionId).toBeNull()
    expect(captured.current?.draft.families).toBeNull()
  })

  it("dismisses a merely open proposal that was never seeded", () => {
    useQueryMock.mockReturnValue([suggestedRow()])
    const { captured } = renderHook({ canSeed: false })
    act(() => captured.current?.dismiss())
    expect(rejectSuggestionMock).toHaveBeenCalledWith({
      orgId: "org-1",
      suggestionId: "sugg-1",
    })
  })

  it("exposes the model tracks as review select options", () => {
    const { captured } = renderHook({})
    expect(captured.current?.trackOptions).toEqual([
      { trackKey: "IC", label: "Individual Contributor" },
      { trackKey: "Lead", label: "Lead" },
    ])
  })
})
```

The `"tracks" in options` check is load-bearing: the `does not seed before the tracks have loaded` case passes `tracks: undefined` explicitly, and a plain `??` default would silently substitute `TRACKS` and make that test vacuous.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=dashboard -- use-pasted-role-draft`
Expected: FAIL, cannot resolve `@/hooks/use-pasted-role-draft`.

- [ ] **Step 3: Write the hook**

Create `apps/dashboard/hooks/use-pasted-role-draft.ts`:

```ts
"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { SuggestionKind } from "@workspace/constants"
import { useState } from "react"
import { useDraftFamilies } from "@/hooks/use-draft-families"
import {
  type SuggestionFlow,
  useSuggestionFlow,
} from "@/hooks/use-suggestion-flow"
import {
  starterImportInputSchema,
  type StarterImportValue,
  starterImportValueSchema,
} from "@/lib/suggestion-schemas"

export interface PastedRoleDraft {
  // The paste view's textarea state and its client gate.
  rawText: string
  setRawText: (value: string) => void
  inputValid: boolean
  // The request round trip (the generation itself is watched through `flow`).
  requestPending: boolean
  requestFailed: boolean
  // The shared read side of the AI suggestion lifecycle.
  flow: SuggestionFlow<StarterImportValue>
  // The editable review list.
  draft: ReturnType<typeof useDraftFamilies>
  trackOptions: { trackKey: string; label: string }[]
  // The proposal the review was seeded from; null until the seed runs.
  seededSuggestionId: Id<"suggestions"> | null
  analyze: () => Promise<void>
  dismiss: () => void
}

// The paste to AI to editable-draft engine, shared by the onboarding families
// step and the in-app role import. It owns the textarea, the request, the
// suggestion lifecycle, and the seed that turns a suggested proposal into the
// editable review list. What each surface DOES with that list (reconcile a
// whole starter set, or add to an existing register) stays with the caller.
//
// The `request` mutation is injected rather than looked up here: the two
// surfaces target different suggestion kinds through different mutations that
// happen to take the same arguments.
export function usePastedRoleDraft(options: {
  orgId: string
  locale: string
  kind: SuggestionKind
  request: (args: {
    orgId: string
    rawText: string
    locale: string
  }) => Promise<unknown>
  // The evaluation model's tracks. Undefined while loading; the seed waits for
  // them because it coerces the proposal's track keys against the real set.
  tracks: { key: string; name: string }[] | undefined
  // False while ANOTHER source owns the screen. Onboarding has two other seed
  // sources (resume-from-existing, and the template create-on-pick), and the AI
  // seed must never win over either: a render-phase setState does not update
  // the caller's local values, so the caller passes an explicit gate instead of
  // relying on block ordering. The in-app import has no other source and passes
  // true (once its own merge data has loaded).
  canSeed: boolean
}): PastedRoleDraft {
  const { orgId, locale, kind, request, tracks, canSeed } = options

  const flow = useSuggestionFlow({
    orgId,
    kind,
    schema: starterImportValueSchema,
  })
  const draft = useDraftFamilies()

  const [rawText, setRawText] = useState("")
  const [requestPending, setRequestPending] = useState(false)
  const [requestFailed, setRequestFailed] = useState(false)
  const [seededSuggestionId, setSeededSuggestionId] =
    useState<Id<"suggestions"> | null>(null)
  // Guards the seed block after a dismiss: the rejected suggestion may still
  // read as "suggested" until the reject round-trips, which would instantly
  // re-seed the review the user just left.
  const [lastDismissedId, setLastDismissedId] = useState<string | null>(null)

  // Seed the review list the first render both the suggestion and the tracks
  // are available (adjust-state-during-render, the established pattern here).
  // Resuming after a reload lands here too: an unreviewed proposal goes
  // straight to review.
  const importValue = flow.value
  if (
    seededSuggestionId === null &&
    canSeed &&
    flow.status === "suggested" &&
    flow.suggestionId !== null &&
    flow.suggestionId !== lastDismissedId &&
    importValue !== null &&
    tracks !== undefined
  ) {
    const validKeys = new Set<string>(tracks.map((track) => track.key))
    const fallbackTrackKey = tracks[0]?.key ?? "IC"
    draft.seed(importValue.families, (trackKey) =>
      validKeys.has(trackKey) ? trackKey : fallbackTrackKey
    )
    setSeededSuggestionId(flow.suggestionId)
  }

  return {
    rawText,
    setRawText,
    inputValid: starterImportInputSchema.safeParse(rawText).success,
    requestPending,
    requestFailed,
    flow,
    draft,
    trackOptions: (tracks ?? []).map((track) => ({
      trackKey: track.key,
      label: track.name,
    })),
    seededSuggestionId,
    analyze: async () => {
      const parsed = starterImportInputSchema.safeParse(rawText)
      if (!parsed.success) return
      setRequestPending(true)
      setRequestFailed(false)
      try {
        await request({ orgId, rawText: parsed.data, locale })
      } catch {
        setRequestFailed(true)
      } finally {
        setRequestPending(false)
      }
    },
    // Back to the paste view with the pasted text intact. The suggestion
    // lifecycle always ends in confirmed or rejected, so an open proposal is
    // dismissed here whether or not it had already seeded a review; the reject
    // is fire-and-forget and flow.status does not flip synchronously, so the id
    // is also latched out of the seed block above.
    dismiss: () => {
      const openId = seededSuggestionId ?? flow.suggestionId
      if (
        openId !== null &&
        (flow.status === "suggested" || flow.status === "failed")
      ) {
        flow.reject().catch(() => {})
        setLastDismissedId(openId)
      }
      draft.clear()
      setSeededSuggestionId(null)
    },
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=dashboard -- use-pasted-role-draft`
Expected: 10 passing.

- [ ] **Step 5: Compose it into the onboarding flow**

In `apps/dashboard/hooks/use-families-draft-flow.ts` make exactly these changes.

**a.** Replace the suggestion/draft/text state. Delete:

```ts
  const flow = useSuggestionFlow({
    orgId,
    kind: SUGGESTION_KINDS.starterImport,
    schema: starterImportValueSchema,
  })
```

```ts
  const draft = useDraftFamilies()

  const [rawText, setRawText] = useState("")
  const [seededFrom, setSeededFrom] = useState<SeedSource | null>(null)
```

```ts
  const [requestPending, setRequestPending] = useState(false)
  const [requestFailed, setRequestFailed] = useState(false)
```

```ts
  const [lastDismissedId, setLastDismissedId] = useState<string | null>(null)
```

and add, after `requestStarterImport` is bound:

```ts
  // The AI seed must not fire while another source owns the screen: a genuine
  // revisit (resume-from-existing) or an in-flight template create. Requiring
  // roles to be RESOLVED and empty makes this independent of block ordering,
  // and createdViaTemplate covers the window where the create has resolved but
  // the listRoles subscription has not yet reported the new roles.
  const canSeedFromAi =
    !resumedExisting &&
    !createdViaTemplate &&
    existingRoles !== undefined &&
    existingRoles.length === 0

  const pasted = usePastedRoleDraft({
    orgId,
    locale,
    kind: SUGGESTION_KINDS.starterImport,
    request: requestStarterImport,
    tracks: model?.tracks,
    canSeed: canSeedFromAi,
  })
  const { draft, flow } = pasted

  // What seeded the review, derived rather than stored: the resume latch means
  // the existing set, a seeded proposal means the AI. Nothing else can seed.
  const seededFrom: SeedSource | null = resumedExisting
    ? { source: "existing" }
    : pasted.seededSuggestionId !== null
      ? { source: "ai", suggestionId: pasted.seededSuggestionId }
      : null
```

`canSeedFromAi` reads `resumedExisting` and `createdViaTemplate`, so move those two `useState` declarations ABOVE it.

**b.** The resume-from-existing block's guard changes from `seededFrom === null` to the two derived parts (it runs before `seededFrom` is computed in source order, so reference the primitives):

```ts
  if (
    !resumedExisting &&
    pasted.seededSuggestionId === null &&
    existingRoles !== undefined &&
    existingRoles.length > 0 &&
    existingFamilies !== undefined &&
    model !== undefined &&
    model !== null
  ) {
```

and its tail drops `setSeededFrom({ source: "existing" })`, keeping only `draft.seed(familyOrder)` and `setResumedExisting(true)`.

Move this block to AFTER the `pasted` declaration so `pasted.seededSuggestionId` and `draft` are in scope.

**c.** Delete the entire second seed block (the `const importValue = flow.value` block and its `if`). It now lives in the shared hook.

**d.** `restart()` becomes:

```ts
  async function restart() {
    if (seededFrom?.source === "existing") {
      if (restartPending) return
      setRestartPending(true)
      setFailure(null)
      try {
        await reconcileStarterSet({ orgId, families: [] })
        draft.clear()
        setResumedExisting(false)
        setCreatedViaTemplate(false)
        setFailure(null)
      } catch (error) {
        setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      } finally {
        setRestartPending(false)
      }
      return
    }
    pasted.dismiss()
    setFailure(null)
  }
```

**e.** In `seedFromTemplate()`, replace the inline dismiss block:

```ts
    if (flow.status === "suggested" || flow.status === "failed") {
      flow.reject().catch(() => {})
      if (flow.suggestionId !== null) setLastDismissedId(flow.suggestionId)
    }
```

with:

```ts
    // Walking away from an open AI proposal dismisses it (the lifecycle always
    // ends in confirmed or rejected) and latches its id out of the seed block,
    // so the in-flight window (create pending, nothing seeded yet, roles still
    // empty, status still "suggested") cannot let it hijack the screen.
    pasted.dismiss()
```

**f.** In `onAnalyze`, delete the whole body and delegate. Remove the local function and, in the returned object, replace `onAnalyze,` with `onAnalyze: pasted.analyze,`.

**g.** In the returned object, replace these entries:

```ts
    rawText: pasted.rawText,
    setRawText: pasted.setRawText,
    inputValid: pasted.inputValid,
    requestPending: pasted.requestPending,
    requestFailed: pasted.requestFailed,
    trackOptions: pasted.trackOptions,
```

and delete the old local `trackOptions` derivation.

**h.** Update the `FamiliesDraftFlow` interface's `flow` field from `ReturnType<typeof useSuggestionFlow<unknown>>` to `SuggestionFlow<StarterImportValue>`, importing both types.

**i.** Delete the now-unused imports: `useDraftFamilies` stays (used by the type of `draft`), `useSuggestionFlow` becomes type-only, `starterImportInputSchema` and `starterImportValueSchema` go, `SUGGESTION_KINDS` stays.

Run `bunx biome check --write apps/dashboard/hooks/use-families-draft-flow.ts` to settle import order, then `bun run typecheck` to catch any leftover reference.

- [ ] **Step 6: Run the onboarding suite**

Run: `bun run test --filter=dashboard -- families-step`
Expected: 32 passing, unchanged. The four that specifically prove this step are `the template review wins even when a suggested AI proposal is open during the in-flight create`, `resume from existing wins over a coincident open AI suggestion`, `holds the spinner while listRoles is still loading, even with a coincident open AI suggestion`, and `start over from an AI review dismisses the suggestion and returns to the paste view`.

- [ ] **Step 7: Run the whole dashboard suite and typecheck**

Run: `bun run test --filter=dashboard` then `bun run typecheck`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add apps/dashboard/hooks/use-pasted-role-draft.ts \
        apps/dashboard/hooks/use-pasted-role-draft.test.tsx \
        apps/dashboard/hooks/use-families-draft-flow.ts
git commit -m "refactor(roles): extract the shared pasted-role draft engine"
```

---

## Phase B: additive backend

### Task 5: Register the `role.import` suggestion kind

A new kind must be labelled everywhere it can surface before anything writes one. Typing `AI_KIND_KEY` by `SuggestionKind` makes that a compile error rather than an empty string in the audit log, and immediately exposes the already-missing `role.profile` entry.

**Files:**
- Modify: `packages/constants/src/suggestions.ts`
- Modify: `packages/backend/convex/lib/auditPayloads.ts:108-135`
- Modify: `apps/dashboard/lib/audit-detail.tsx:528-560`
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `SUGGESTION_KINDS.roleImport === "role.import"`; an `AiConfirmedPayload` variant `{ suggestionId: string; kind: "role.import"; familyCount: number; roleCount: number; skippedCount: number; families: unknown[] }`.

- [ ] **Step 1: Add the kind**

In `packages/constants/src/suggestions.ts`, add ONE line to the existing object. Do not retype the object from this plan: read the file and append, because it already contains `criterionCompliance` which an earlier draft of this plan omitted.

```ts
export const SUGGESTION_KINDS = {
  modelDraft: "model.draft",
  weightReview: "model.weightReview",
  roleProfile: "role.profile",
  starterImport: "starter.import",
  criterionCompliance: "criterion.compliance",
  roleImport: "role.import",
} as const
```

- [ ] **Step 2: Add the audit payload variant**

In `packages/backend/convex/lib/auditPayloads.ts`, append to the `AiConfirmedPayload` union (after the `starter.import` member):

```ts
  | {
      suggestionId: string
      kind: "role.import"
      familyCount: number
      roleCount: number
      skippedCount: number
      families: unknown[]
    }
```

- [ ] **Step 3: Type the kind-label map and add the case**

In `apps/dashboard/lib/audit-detail.tsx`, replace lines 528-533:

```ts
// Maps "model.draft" -> "modelDraft", etc., for i18n keys (ai.kind.<key>).
// Typed by SuggestionKind and total, so a kind added to SUGGESTION_KINDS
// without a label here is a compile error rather than a blank audit detail.
export const AI_KIND_KEY: Record<SuggestionKind, string> = {
  "model.draft": "modelDraft",
  "model.weightReview": "weightReview",
  "role.profile": "roleProfile",
  "starter.import": "starterImport",
  "criterion.compliance": "criterionCompliance",
  "role.import": "roleImport",
}

function isSuggestionKind(value: string): value is SuggestionKind {
  return value in AI_KIND_KEY
}
```

Note the map today holds only three entries. Making it total over `SuggestionKind` therefore adds THREE: `role.profile` and `criterion.compliance`, both of which render an empty audit detail today because they were never labelled, plus the new `role.import`. All three need `ai.kind.*` labels below. That is the point of the typing change: it surfaces the two pre-existing gaps.

with `import type { SuggestionKind } from "@workspace/constants"` added at the top.

Then in `aiAuditDetail`, change the lookup and add the case:

```ts
  const kindKey = isSuggestionKind(kind) ? AI_KIND_KEY[kind] : undefined
```

```ts
    case "role.import":
      return t("ai.roleImport", {
        families: num(p.familyCount),
        roles: num(p.roleCount),
      })
```

- [ ] **Step 4: Add the labels in all five locales**

Under `dashboard.auditLog.ai` in each file, add `roleImport` next to `starterImport`, and add the two missing `kind` entries.

`en.json`:

```json
        "roleImport": "Role import: {families, plural, one {# family} other {# families}}, {roles, plural, one {# role} other {# roles}}",
        "kind": {
          "modelDraft": "Model criteria",
          "weightReview": "Weight review",
          "roleProfile": "Role profile",
          "starterImport": "Starter roles",
          "criterionCompliance": "Criterion review",
          "roleImport": "Imported roles"
        }
```

`sv.json`:

```json
        "roleImport": "Rollimport: {families, plural, one {# familj} other {# familjer}}, {roles, plural, one {# roll} other {# roller}}",
        "kind": {
          "modelDraft": "Modellkriterier",
          "weightReview": "Viktgenomgång",
          "roleProfile": "Rollprofil",
          "starterImport": "Startroller",
          "criterionCompliance": "Kriteriegranskning",
          "roleImport": "Importerade roller"
        }
```

`nb.json`:

```json
        "roleImport": "Rolleimport: {families, plural, one {# familie} other {# familier}}, {roles, plural, one {# rolle} other {# roller}}",
        "kind": {
          "modelDraft": "Modellkriterier",
          "weightReview": "Vektgjennomgang",
          "roleProfile": "Rolleprofil",
          "starterImport": "Startroller",
          "criterionCompliance": "Kriteriegjennomgang",
          "roleImport": "Importerte roller"
        }
```

`da.json`:

```json
        "roleImport": "Rolleimport: {families, plural, one {# familie} other {# familier}}, {roles, plural, one {# rolle} other {# roller}}",
        "kind": {
          "modelDraft": "Modelkriterier",
          "weightReview": "Vægtgennemgang",
          "roleProfile": "Rolleprofil",
          "starterImport": "Startroller",
          "criterionCompliance": "Kriteriegennemgang",
          "roleImport": "Importerede roller"
        }
```

`fi.json`:

```json
        "roleImport": "Roolien tuonti: {families, plural, one {# perhe} other {# perhettä}}, {roles, plural, one {# rooli} other {# roolia}}",
        "kind": {
          "modelDraft": "Mallin kriteerit",
          "weightReview": "Painotusten tarkistus",
          "roleProfile": "Roolikuvaus",
          "starterImport": "Aloitusroolit",
          "criterionCompliance": "Kriteerien tarkistus",
          "roleImport": "Tuodut roolit"
        }
```

The existing `modelDraft` / `weightReview` values must be preserved verbatim from each file (they already exist); only `roleProfile` and `roleImport` are new. Read each file's current block before editing rather than pasting the above wholesale, and use Write/Edit, never shell text tools, so the diacritics survive.

- [ ] **Step 5: Verify no mojibake and run the parity test**

Run: `grep -n "Ã¤\|Ã¶\|Ã¥\|Ã©\|â€" packages/i18n/messages/*.json`
Expected: no output.

Run: `bun run test --filter=@workspace/i18n && bun run test --filter=dashboard -- audit-labels`
Expected: parity and audit-label coverage pass.

- [ ] **Step 6: Typecheck**

Run: `bun run typecheck`
Expected: green. If `AI_KIND_KEY` reports a missing key, add it rather than loosening the type. That error is the feature.

- [ ] **Step 7: Commit**

```bash
git add packages/constants/src/suggestions.ts \
        packages/backend/convex/lib/auditPayloads.ts \
        apps/dashboard/lib/audit-detail.tsx \
        packages/i18n/messages/*.json
git commit -m "feat(roles): register the role.import suggestion kind and label every kind"
```

---

### Task 6: Extract `roleTitleKey`

The additive import needs a non-throwing duplicate check over an already-loaded role list, using exactly the comparison `createRole` enforces. One key builder, two consumers.

**Files:**
- Modify: `packages/backend/convex/assessment/roles.ts:74-95`
- Modify: `packages/backend/convex/assessment/roles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `roleTitleKey(familyId: Id<"roleFamilies"> | undefined, title: string): string`, exported from `convex/assessment/roles.ts`.

- [ ] **Step 1: Write the failing test**

Append to `packages/backend/convex/assessment/roles.test.ts`, inside the top-level `describe`:

```ts
  describe("roleTitleKey", () => {
    it("is case-insensitive and whitespace-insensitive", () => {
      expect(roleTitleKey(FAMILY_A, "  Backend Engineer ")).toBe(
        roleTitleKey(FAMILY_A, "backend engineer")
      )
    })

    it("scopes the key to the family", () => {
      expect(roleTitleKey(FAMILY_A, "Developer")).not.toBe(
        roleTitleKey(FAMILY_B, "Developer")
      )
    })

    it("gives family-less roles their own scope", () => {
      expect(roleTitleKey(undefined, "Developer")).not.toBe(
        roleTitleKey(FAMILY_A, "Developer")
      )
    })
  })
```

with, above the outer `describe`:

```ts
// Opaque ids: roleTitleKey only ever stringifies them.
const FAMILY_A = "fam_a" as Id<"roleFamilies">
const FAMILY_B = "fam_b" as Id<"roleFamilies">
```

and `import { roleTitleKey } from "./roles"` plus `import type { Id } from "../_generated/dataModel"`.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=@workspace/backend -- roles`
Expected: FAIL, `roleTitleKey` is not exported.

- [ ] **Step 3: Extract the helper and use it**

In `packages/backend/convex/assessment/roles.ts`, above `assertUniqueRoleTitle`:

```ts
// The uniqueness key for a role title inside its family: case-insensitive,
// whitespace-trimmed, family-scoped, and distinct for a family-less role.
// Exported so every path deciding "is this title already taken here" compares
// identically (createRole's assert and the additive import's skip pass).
export function roleTitleKey(
  familyId: Id<"roleFamilies"> | undefined,
  title: string
): string {
  return `${familyId ?? ""}:${title.trim().toLowerCase()}`
}
```

and rewrite the body of `assertUniqueRoleTitle` to use it:

```ts
async function assertUniqueRoleTitle(
  ctx: MutationCtx,
  orgId: string,
  title: string,
  familyId: Id<"roleFamilies"> | undefined,
  excludeId?: Id<"roles">
): Promise<void> {
  const roles = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const key = roleTitleKey(familyId, title)
  const clash = roles.some(
    (role) =>
      role._id !== excludeId &&
      role.archivedAt === undefined &&
      roleTitleKey(role.familyId, role.title) === key
  )
  if (clash) throw appError(ERROR_CODES.roleExists)
}
```

- [ ] **Step 4: Run the backend role tests**

Run: `bun run test --filter=@workspace/backend -- roles`
Expected: the three new unit tests plus every existing role test pass. The duplicate-title tests are what prove the rewrite is equivalent.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/assessment/roles.ts \
        packages/backend/convex/assessment/roles.test.ts
git commit -m "refactor(roles): extract the shared role-title uniqueness key"
```

---

### Task 7: Reserve role slugs that a static route would shadow

`/roles/import` is about to join `/roles/families` as a static segment. A role whose title slugs to either becomes permanently unreachable, which is already true for "Families" today.

**Files:**
- Modify: `packages/backend/convex/lib/slug.ts`
- Modify: `packages/backend/convex/lib/slug.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: no new exports. `uniqueSlug` never returns `"import"` or `"families"` for the `roles` table.

- [ ] **Step 1: Write the failing test**

Append to `packages/backend/convex/lib/slug.test.ts` (mirror the file's existing setup helper for creating an org and calling `uniqueSlug` inside `t.run`):

```ts
  it("never gives a role a slug a static route would shadow", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const importSlug = await uniqueSlug(ctx, "roles", "org-1", "Import")
      const familiesSlug = await uniqueSlug(ctx, "roles", "org-1", "Families")
      expect(importSlug).not.toBe("import")
      expect(familiesSlug).not.toBe("families")
    })
  })

  it("prefers the family prefix over a random suffix for a reserved title", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      const slug = await uniqueSlug(ctx, "roles", "org-1", "Import", {
        prefix: "finance",
      })
      expect(slug).toBe("finance-import")
    })
  })

  it("leaves role FAMILY slugs alone (no static sibling to shadow)", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      expect(await uniqueSlug(ctx, "roleFamilies", "org-1", "Import")).toBe(
        "import"
      )
    })
  })
```

If `slug.test.ts` does not exist, create it with the same `initConvexTest` import used by `packages/backend/convex/assessment/roles.test.ts` and a top-level `describe("uniqueSlug", ...)`.

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=@workspace/backend -- slug`
Expected: FAIL, `importSlug` is `"import"`.

- [ ] **Step 3: Add the reserved set**

In `packages/backend/convex/lib/slug.ts`, after the `SlugTable` type:

```ts
// Slugs a static route segment would shadow, per table: /roles/import and
// /roles/families resolve to their own pages, so a role holding either slug
// would be unreachable at its own URL. Treated as permanently taken, so the
// generator falls through to the readable prefixed form and then a short-id
// suffix. Role families sit under /roles/families/<slug>, where no static
// sibling exists, so they reserve nothing.
const RESERVED_SLUGS: Record<SlugTable, readonly string[]> = {
  roles: ["import", "families"],
  roleFamilies: [],
  payMappingRuns: [],
}
```

and make `isTaken` consult it as its first check:

```ts
  const isTaken = async (slug: string): Promise<boolean> => {
    if (RESERVED_SLUGS[table].includes(slug)) return true
    // Branch on the concrete table name so the by_org_slug index (and its
    // compound eq range) resolves; a union table arg loses the index typing.
    const hit =
```

(the rest of `isTaken` is unchanged).

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=@workspace/backend -- slug`
Expected: 3 new tests pass, existing slug tests unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/backend/convex/lib/slug.ts packages/backend/convex/lib/slug.test.ts
git commit -m "fix(roles): stop a role taking a slug a static route would shadow"
```

---

### Task 8: `insertAdditiveRoles` and `confirmRoleImport`

The additive persist path. Purely additive, validated before the first write, skipping rather than rejecting duplicate titles.

**Files:**
- Modify: `packages/backend/convex/assessment/starters.ts` (add the helper and its shapes)
- Modify: `packages/backend/convex/ai/suggest.ts` (add the confirm mutation)
- Modify: `packages/backend/convex/ai/suggest.test.ts`

**Interfaces:**
- Consumes: `roleTitleKey` (Task 6), `SUGGESTION_KINDS.roleImport` and the `role.import` payload variant (Task 5), reserved slugs (Task 7).
- Produces:
  - `additiveFamilyShape` (a Convex validator) and `insertAdditiveRoles(ctx, { orgId, actorId, families }): Promise<AdditiveImportResult>` from `convex/assessment/starters.ts`
  - `AdditiveImportResult = { createdRoleIds: Id<"roles">[]; familyCount: number; roleCount: number; skippedCount: number; families: InsertedStarterFamily[] }`
  - `api.ai.suggest.confirmRoleImport({ orgId, suggestionId, families })` returning `{ createdRoleIds, familyCount, roleCount, skippedCount }`

- [ ] **Step 1: Write the failing tests**

Append to `packages/backend/convex/ai/suggest.test.ts`, inside the same `describe` block that holds the starter-import tests (it already has `seedScratchOrganization` and `SUGGESTED_FAMILIES` in scope):

```ts
  // Moves a role.import suggestion to "suggested" so confirmRoleImport can run.
  // saveStarterImport is kind-agnostic (it only validates the shape), so it
  // serves both import kinds.
  async function suggestedRoleImport(
    t: ReturnType<typeof initConvexTest>,
    asAdmin: ReturnType<ReturnType<typeof initConvexTest>["withIdentity"]>,
    orgId: string,
    families: typeof SUGGESTED_FAMILIES
  ) {
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestRoleImport,
      { orgId, rawText: "Software Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId,
      families,
    })
    return suggestionId
  }

  it("confirmRoleImport adds roles into an existing family without touching it", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "",
      team: "",
      trackKey: "IC",
      familyId,
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      {
        name: "Engineering",
        roles: [
          { title: "SRE", trackKey: "IC" },
          // Already present in this family: skipped, not rejected.
          { title: "developer", trackKey: "IC" },
        ],
      },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          familyId,
          name: "Engineering",
          roles: [
            { title: "SRE", trackKey: "IC" as const },
            { title: "developer", trackKey: "IC" as const },
          ],
        },
      ],
    })
    expect(result.roleCount).toBe(1)
    expect(result.skippedCount).toBe(1)
    expect(result.familyCount).toBe(0)
    expect(result.createdRoleIds).toHaveLength(1)
    await t.run(async (ctx) => {
      const families = await ctx.db
        .query("roleFamilies")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(families).toHaveLength(1)
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles.map((role) => role.title).sort()).toEqual([
        "Developer",
        "SRE",
      ])
      expect(roles.every((role) => role.archivedAt === undefined)).toBe(true)
    })
  })

  it("confirmRoleImport creates a genuinely new family", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Legal", roles: [{ title: "Legal Counsel", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          name: "Legal",
          roles: [{ title: "Legal Counsel", trackKey: "IC" as const }],
        },
      ],
    })
    expect(result).toMatchObject({
      familyCount: 1,
      roleCount: 1,
      skippedCount: 0,
    })
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("confirmed")
      const audit = await ctx.db
        .query("auditLog")
        .withIndex("by_org_type", (q) =>
          q.eq("orgId", orgId).eq("type", "ai.suggestionConfirmed")
        )
        .collect()
      expect(audit[0]?.payload).toMatchObject({
        kind: "role.import",
        familyCount: 1,
        roleCount: 1,
        skippedCount: 0,
      })
    })
  })

  it("confirmRoleImport rejects a new family whose name is already taken", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
        orgId,
        suggestionId,
        // No familyId: asks to CREATE "Engineering", which already exists.
        families: [
          { name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" as const }] },
        ],
      })
    ).rejects.toThrow(/errors.roleFamilyExists/)
    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      expect(roles).toHaveLength(0)
      expect((await ctx.db.get(suggestionId))?.status).toBe("suggested")
    })
  })

  it("confirmRoleImport rejects a familyId from another org", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const other = await seedScratchOrganization(t)
    const foreignFamilyId = await other.asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId: other.orgId, name: "Engineering" }
    )
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
        orgId,
        suggestionId,
        families: [
          {
            familyId: foreignFamilyId,
            name: "Engineering",
            roles: [{ title: "SRE", trackKey: "IC" as const }],
          },
        ],
      })
    ).rejects.toThrow(/errors.notFound/)
  })

  it("confirmRoleImport skips a duplicate inside the payload itself", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Legal", roles: [{ title: "Legal Counsel", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          name: "Legal",
          roles: [
            { title: "Legal Counsel", trackKey: "IC" as const },
            { title: "  legal counsel  ", trackKey: "Lead" as const },
          ],
        },
      ],
    })
    expect(result).toMatchObject({ roleCount: 1, skippedCount: 1 })
  })

  it("confirmRoleImport creates no empty family when every role is skipped", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const familyId = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Developer",
      function: "",
      team: "",
      trackKey: "IC",
      familyId,
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Engineering", roles: [{ title: "Developer", trackKey: "IC" }] },
    ])
    const result = await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        {
          familyId,
          name: "Engineering",
          roles: [{ title: "Developer", trackKey: "IC" as const }],
        },
      ],
    })
    expect(result).toMatchObject({ roleCount: 0, skippedCount: 1 })
    await t.run(async (ctx) => {
      // Nothing landed, so the proposal closes as rejected like an emptied list.
      expect((await ctx.db.get(suggestionId))?.status).toBe("rejected")
    })
  })

  it("confirmRoleImport prefixes a colliding role slug with its family", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const engineering = await asAdmin.mutation(
      api.assessment.families.createRoleFamily,
      { orgId, name: "Engineering" }
    )
    await asAdmin.mutation(api.assessment.roles.createRole, {
      orgId,
      title: "Manager",
      function: "",
      team: "",
      trackKey: "IC",
      familyId: engineering,
    })
    const suggestionId = await suggestedRoleImport(t, asAdmin, orgId, [
      { name: "Sales", roles: [{ title: "Manager", trackKey: "M" }] },
    ])
    await asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
      orgId,
      suggestionId,
      families: [
        { name: "Sales", roles: [{ title: "Manager", trackKey: "M" as const }] },
      ],
    })
    await t.run(async (ctx) => {
      const roles = await ctx.db
        .query("roles")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect()
      const slugs = roles.map((role) => role.slug).sort()
      expect(slugs).toEqual(["manager", "sales-manager"])
    })
  })

  it("confirmRoleImport rejects a foreign or wrong-kind suggestion", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const starterId = await asAdmin.mutation(
      api.ai.suggest.requestStarterImport,
      { orgId, rawText: "Developer" }
    )
    await t.mutation(internal.ai.persist.saveStarterImport, {
      suggestionId: starterId,
      families: SUGGESTED_FAMILIES,
    })
    await expect(
      asAdmin.mutation(api.ai.suggest.confirmRoleImport, {
        orgId,
        suggestionId: starterId,
        families: [
          { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" as const }] },
        ],
      })
    ).rejects.toThrow(/errors.notFound/)
  })
```

If `api.assessment.families.createRoleFamily` takes different args, read `packages/backend/convex/assessment/families.ts` and adjust the three call sites; the rest of each test is unaffected. Likewise confirm the track keys available on the scratch model (`IC`, `Lead`, `M` per ADR-0006) before relying on `"M"`.

- [ ] **Step 2: Run to verify they fail**

Run: `bun run test --filter=@workspace/backend -- suggest`
Expected: FAIL, `confirmRoleImport` and `requestRoleImport` do not exist. `requestRoleImport` arrives in Task 9; until then these tests stay red, which is expected and is why Tasks 8 and 9 share one commit at the end of Task 9.

- [ ] **Step 3: Add the shapes and the helper**

In `packages/backend/convex/assessment/starters.ts`, after `starterFamilyShape`:

```ts
// The in-app additive import payload: a family either targets an EXISTING
// family by id (its roles are added into it) or is created from `name`.
export const additiveFamilyShape = v.object({
  familyId: v.optional(v.id("roleFamilies")),
  name: v.string(),
  roles: v.array(
    v.object({ title: v.string(), trackKey: trackKeyValidator })
  ),
})

export interface AdditiveFamilyInput {
  familyId?: Id<"roleFamilies">
  name: string
  roles: { title: string; trackKey: string }[]
}

// What one additive import landed. `createdRoleIds` is what lets the caller
// scope the profile prefill to exactly these roles.
export interface AdditiveImportResult {
  createdRoleIds: Id<"roles">[]
  familyCount: number
  roleCount: number
  skippedCount: number
  families: InsertedStarterFamily[]
}
```

with `import { roleTitleKey } from "./roles"` and `ROLE_CREATE_FIELDS` added to the existing `../lib/audit` import.

Then append the helper:

```ts
// Adds roles (and, where needed, families) to an org that ALREADY has some.
// Purely additive: nothing existing is renamed, re-tracked, or archived, which
// is what separates this from reconcileStarterSet. A role whose title is
// already taken in its target family is SKIPPED rather than rejected, so
// re-pasting an overlapping list stays safe and a long review is never thrown
// away over one collision; the review surface flags those rows in advance.
//
// The whole payload is validated before the first write (the same discipline
// reconcileStarterSet uses), so a rejection rolls back cleanly.
export async function insertAdditiveRoles(
  ctx: MutationCtx,
  args: {
    orgId: string
    actorId: string
    families: AdditiveFamilyInput[]
  }
): Promise<AdditiveImportResult> {
  const { orgId, actorId, families } = args
  const empty: AdditiveImportResult = {
    createdRoleIds: [],
    familyCount: 0,
    roleCount: 0,
    skippedCount: 0,
    families: [],
  }
  if (families.length === 0) return empty
  if (families.length > MAX_FAMILIES) throw appError(ERROR_CODES.invalidInput)
  const totalRoles = families.reduce(
    (sum, family) => sum + family.roles.length,
    0
  )
  if (totalRoles > MAX_ROLES) throw appError(ERROR_CODES.invalidInput)

  // One correlation id per import, so every audit row this writer emits
  // reconstructs as a single import unit.
  const batchId = crypto.randomUUID()

  const existingFamilies = await ctx.db
    .query("roleFamilies")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  const familyById = new Map(
    existingFamilies.map((family) => [family._id as string, family])
  )
  const takenFamilyNames = new Set(
    existingFamilies.map((family) => family.name.toLowerCase())
  )
  const allRoles = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  // Title keys already taken by a live role, keyed exactly the way createRole's
  // assert keys them. Grows as this import writes, so two payload cards
  // targeting the SAME existing family cannot both create the same title.
  const takenTitles = new Set(
    allRoles
      .filter((role) => role.archivedAt === undefined)
      .map((role) => roleTitleKey(role.familyId, role.title))
  )

  // 1. Validate everything BEFORE any write.
  const newNames = new Set<string>()
  for (const family of families) {
    if (family.familyId !== undefined) {
      if (!familyById.has(family.familyId as string)) {
        throw appError(ERROR_CODES.notFound)
      }
    } else {
      const name = family.name.trim()
      if (name.length === 0 || name.length > MAX_FAMILY_NAME) {
        throw appError(ERROR_CODES.invalidInput)
      }
      const lowered = name.toLowerCase()
      if (takenFamilyNames.has(lowered) || newNames.has(lowered)) {
        throw appError(ERROR_CODES.roleFamilyExists)
      }
      newNames.add(lowered)
    }
    for (const role of family.roles) {
      const title = role.title.trim()
      if (title.length === 0 || title.length > MAX_ROLE_TITLE) {
        throw appError(ERROR_CODES.invalidInput)
      }
      // Tracks are fixed constants (ADR-0006). The validator already narrows
      // this; guard defensively in case it is ever loosened.
      if (!isTrackKey(role.trackKey)) throw appError(ERROR_CODES.invalidInput)
    }
  }

  // 2. Write.
  const created: InsertedStarterFamily[] = []
  const createdRoleIds: Id<"roles">[] = []
  let familyCount = 0
  let skippedCount = 0

  for (const family of families) {
    const targetId = family.familyId
    // Resolve which roles actually land BEFORE creating a new family, so an
    // all-skipped family never leaves an empty shell in the register.
    const seenInNewFamily = new Set<string>()
    const pending: { title: string; trackKey: string }[] = []
    for (const role of family.roles) {
      const title = role.title.trim()
      if (targetId !== undefined) {
        const key = roleTitleKey(targetId, title)
        if (takenTitles.has(key)) {
          skippedCount += 1
          continue
        }
        takenTitles.add(key)
      } else {
        // A brand-new family holds no stored roles, so only the payload's own
        // duplicates can collide inside it.
        const lowered = title.toLowerCase()
        if (seenInNewFamily.has(lowered)) {
          skippedCount += 1
          continue
        }
        seenInNewFamily.add(lowered)
      }
      pending.push({ title, trackKey: role.trackKey })
    }
    if (pending.length === 0) continue

    let familyId: Id<"roleFamilies">
    let familySlug: string
    let familyName: string
    if (targetId !== undefined) {
      const existing = familyById.get(targetId as string)
      if (existing === undefined) throw appError(ERROR_CODES.notFound)
      familyId = existing._id
      familySlug = existing.slug
      familyName = existing.name
    } else {
      familyName = family.name.trim()
      familySlug = await uniqueSlug(ctx, "roleFamilies", orgId, familyName)
      familyId = await ctx.db.insert("roleFamilies", {
        orgId,
        name: familyName,
        slug: familySlug,
      })
      familyCount += 1
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.roleFamilyCreated,
        actorId,
        payload: {
          familyId,
          source: "aiImport",
          batchId,
          changes: { name: { from: null, to: familyName } },
        },
      })
    }

    const createdRoles: InsertedStarterFamily["roles"] = []
    for (const role of pending) {
      // Roles insert with EMPTY function/team and an empty profile (honest
      // drafts, no invented data); the caller's scoped prefill fills the
      // profile. The family-slug prefix matches createRole, so a title shared
      // across two families gets a readable slug rather than a random suffix.
      const roleId = await ctx.db.insert("roles", {
        orgId,
        title: role.title,
        slug: await uniqueSlug(ctx, "roles", orgId, role.title, {
          prefix: familySlug,
        }),
        function: "",
        team: "",
        trackKey: role.trackKey,
        familyId,
        purpose: "",
        responsibilities: "",
      })
      await logAudit(ctx, {
        orgId,
        type: AUDIT_EVENTS.roleCreated,
        actorId,
        payload: {
          roleId,
          familyId,
          source: "aiImport",
          batchId,
          changes: buildCreateChanges(
            {
              title: role.title,
              function: "",
              team: "",
              trackKey: role.trackKey,
              familyId,
              purpose: "",
              responsibilities: "",
            },
            ROLE_CREATE_FIELDS
          ),
        },
      })
      createdRoles.push({ roleId, title: role.title, trackKey: role.trackKey })
      createdRoleIds.push(roleId)
    }
    created.push({ familyId, name: familyName, roles: createdRoles })
  }

  return {
    createdRoleIds,
    familyCount,
    roleCount: createdRoleIds.length,
    skippedCount,
    families: created,
  }
}
```

- [ ] **Step 4: Add the confirm mutation**

In `packages/backend/convex/ai/suggest.ts`, after `confirmStarterImport`:

```ts
// Confirms the in-app role import with the user's EDITED list. Unlike
// confirmStarterImport this is purely additive: it never archives or renames
// anything, and a family carrying a familyId means "add into that existing
// family". Member scope, like createRole and the role register.
export const confirmRoleImport = orgMutation({
  args: {
    suggestionId: v.id("suggestions"),
    families: v.array(additiveFamilyShape),
  },
  returns: v.object({
    createdRoleIds: v.array(v.id("roles")),
    familyCount: v.number(),
    roleCount: v.number(),
    skippedCount: v.number(),
  }),
  handler: async (ctx, { suggestionId, families }) => {
    const suggestion = await ctx.db.get(suggestionId)
    if (
      suggestion === null ||
      suggestion.orgId !== ctx.orgId ||
      suggestion.target.kind !== SUGGESTION_KINDS.roleImport ||
      suggestion.status !== "suggested"
    ) {
      throw appError(ERROR_CODES.notFound)
    }
    const result = await insertAdditiveRoles(ctx, {
      orgId: ctx.orgId,
      actorId: ctx.authUserId,
      families,
    })
    // Nothing landed (every role already existed, or the list was emptied in
    // review): the proposal closes as rejected, mirroring the other confirms.
    await ctx.db.patch(suggestionId, {
      status: result.roleCount > 0 ? "confirmed" : "rejected",
      confirmedBy: ctx.authUserId,
    })
    // The per-row role.created / roleFamily.created rows carry the field-level
    // snapshots; this is the import-level summary.
    await ctx.audit.log({
      type: AUDIT_EVENTS.aiSuggestionConfirmed,
      payload: {
        suggestionId,
        kind: SUGGESTION_KINDS.roleImport,
        familyCount: result.familyCount,
        roleCount: result.roleCount,
        skippedCount: result.skippedCount,
        families: result.families,
      },
    })
    return {
      createdRoleIds: result.createdRoleIds,
      familyCount: result.familyCount,
      roleCount: result.roleCount,
      skippedCount: result.skippedCount,
    }
  },
})
```

extending the existing `../assessment/starters` import to `{ additiveFamilyShape, insertAdditiveRoles, insertStarterSet, starterFamilyShape }`.

- [ ] **Step 5: Proceed to Task 9**

The new tests still fail on `requestRoleImport`. Do not commit yet; Task 9 completes the pair.

---

### Task 9: `requestRoleImport` and the existing-families prompt line

**Files:**
- Modify: `packages/backend/convex/ai/suggest.ts`
- Modify: `packages/backend/convex/ai/generate.ts:190-224`
- Modify: `packages/backend/convex/ai/suggest.test.ts`

**Interfaces:**
- Consumes: `SUGGESTION_KINDS.roleImport` (Task 5), `confirmRoleImport` (Task 8).
- Produces: `api.ai.suggest.requestRoleImport({ orgId, rawText, locale? })` returning `Id<"suggestions">`; `internal.ai.generate.generateStarterImport` gains an optional `existingFamilies: string[]` arg.

- [ ] **Step 1: Write the failing tests**

Append to the same describe block in `packages/backend/convex/ai/suggest.test.ts`:

```ts
  it("requestRoleImport inserts a generating row of its own kind", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    const suggestionId = await asAdmin.mutation(
      api.ai.suggest.requestRoleImport,
      { orgId, rawText: "Backend Engineer\nSRE" }
    )
    await t.run(async (ctx) => {
      const suggestion = await ctx.db.get(suggestionId)
      expect(suggestion?.status).toBe("generating")
      expect(suggestion?.source).toBe("ai")
      expect(suggestion?.target.kind).toBe("role.import")
      expect(suggestion?.model?.model).toBe(AI_MODEL_ID)
      expect(suggestion?.requestedBy).toBeTruthy()
    })
  })

  it("requestRoleImport rejects blank and oversized text", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await expect(
      asAdmin.mutation(api.ai.suggest.requestRoleImport, {
        orgId,
        rawText: "   \n  ",
      })
    ).rejects.toThrow(/errors.invalidInput/)
    await expect(
      asAdmin.mutation(api.ai.suggest.requestRoleImport, {
        orgId,
        rawText: "x".repeat(20_001),
      })
    ).rejects.toThrow(/errors.invalidInput/)
  })

  it("requestRoleImport passes the org's existing family names to the generator", async () => {
    const t = initConvexTest()
    const { orgId, asAdmin } = await seedScratchOrganization(t)
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Engineering",
    })
    await asAdmin.mutation(api.assessment.families.createRoleFamily, {
      orgId,
      name: "Sales",
    })
    await asAdmin.mutation(api.ai.suggest.requestRoleImport, {
      orgId,
      rawText: "SRE",
    })
    // The scheduled action carries the names, so the prompt can ask the model
    // to reuse them instead of inventing a near-duplicate family.
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    )
    const args = scheduled.at(-1)?.args[0] as
      | { existingFamilies?: string[] }
      | undefined
    expect(args?.existingFamilies?.slice().sort()).toEqual([
      "Engineering",
      "Sales",
    ])
  })
```

If reading `_scheduled_functions` through `ctx.db.system` is not how this repo inspects scheduled work, find the existing precedent in `packages/backend/convex` tests and follow it; if there is none, drop this third test and instead assert the behaviour at the unit level by exporting and testing a small `existingFamilyNames(ctx, orgId)` helper.

- [ ] **Step 2: Run to verify they fail**

Run: `bun run test --filter=@workspace/backend -- suggest`
Expected: FAIL, `requestRoleImport` does not exist.

- [ ] **Step 3: Add the request mutation**

In `packages/backend/convex/ai/suggest.ts`, after `requestStarterImport`:

```ts
// The in-app role import: the same paste-and-group generation as the
// onboarding starter import, but for an org that already has a register. Its
// own kind, so the two surfaces can never pick up each other's open proposals
// and so AI spend stays attributable per surface. Member scope, like
// createRole.
export const requestRoleImport = orgMutation({
  args: { rawText: v.string(), locale: v.optional(v.string()) },
  returns: v.id("suggestions"),
  handler: async (ctx, { rawText, locale }) => {
    const settings = await requireCompleteSettings(ctx, ctx.orgId)
    const text = rawText.trim()
    if (text.length === 0 || text.length > MAX_STARTER_IMPORT_TEXT) {
      throw appError(ERROR_CODES.invalidInput)
    }
    const resolvedLocale = promptLocale(locale, settings.locale)
    const trackNames = templateContent(clampLocale(resolvedLocale)).trackNames
    // The org's existing families go into the prompt so the model reuses an
    // exact name where a pasted role fits one, instead of inventing
    // "Engineering Team" beside the existing "Engineering". Family names are
    // role-level organizational content: no person data is involved.
    const families = await ctx.db
      .query("roleFamilies")
      .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
      .collect()
    const suggestionId = await ctx.db.insert("suggestions", {
      orgId: ctx.orgId,
      target: { kind: SUGGESTION_KINDS.roleImport },
      suggestedValue: null,
      source: "ai",
      status: "generating",
      model: { provider: AI_PROVIDER, model: AI_MODEL_ID },
      requestedBy: ctx.authUserId,
    })
    await ctx.scheduler.runAfter(
      0,
      internal.ai.generate.generateStarterImport,
      {
        suggestionId,
        locale: resolvedLocale,
        industry: settings.industry,
        country: settings.country,
        ...(settings.employeeCount !== undefined
          ? { employeeCount: settings.employeeCount }
          : {}),
        rawText: text,
        tracks: TRACK_KEYS.map((key) => ({ key, name: trackNames[key] })),
        existingFamilies: families.map((family) => family.name),
      }
    )
    return suggestionId
  },
})
```

- [ ] **Step 4: Teach the generator about existing families**

In `packages/backend/convex/ai/generate.ts`, add to `generateStarterImport`'s args:

```ts
    existingFamilies: v.optional(v.array(v.string())),
```

and insert one line into the prompt array, immediately after the "Organize the pasted roles into role families..." line:

```ts
          ...(args.existingFamilies !== undefined &&
          args.existingFamilies.length > 0
            ? [
                `The organization already has these role families: ${JSON.stringify(args.existingFamilies)}. When a pasted role belongs to one of them, use that family name EXACTLY as written here. Create a new family only for roles that fit none of them.`,
              ]
            : []),
```

Nothing else changes: the output schema, `sanitizeStarterImport`, the caps, and the save/markFailed paths are shared by both kinds.

- [ ] **Step 5: Run the backend suite**

Run: `bun run test --filter=@workspace/backend -- suggest`
Expected: every Task 8 and Task 9 test passes, and the existing starter-import tests are untouched.

- [ ] **Step 6: Run the whole backend suite and typecheck**

Run: `bun run test --filter=@workspace/backend` then `bun run typecheck`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add packages/backend/convex/assessment/starters.ts \
        packages/backend/convex/ai/suggest.ts \
        packages/backend/convex/ai/generate.ts \
        packages/backend/convex/ai/suggest.test.ts
git commit -m "feat(roles): additive AI role import backend"
```

---

### Task 10: Scope `prefillRoleProfiles` to specific roles

Without this, an in-app import of three roles drafts profiles for every empty-profile role in the org: real model spend and an audit row each.

**Files:**
- Modify: `packages/backend/convex/ai/prefill.ts:87-112`
- Modify: `packages/backend/convex/ai/prefillData.ts:32-58` and its handler
- Modify: `packages/backend/convex/ai/prefill.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `api.ai.prefill.prefillRoleProfiles({ orgId, locale?, roleIds? })`, unchanged return `{ generated, failed }`.

- [ ] **Step 1: Write the failing test**

Append to `packages/backend/convex/ai/prefill.test.ts`, following the file's existing pattern for seeding roles and asserting on `collectPrefillTargets`:

```ts
  it("collectPrefillTargets narrows to the given roleIds", async () => {
    const t = initConvexTest()
    const { orgId, userId, roleIds } = await seedRolesWithEmptyProfiles(t, 3)
    const scoped = roleIds.slice(0, 2)
    const { targets } = await t.query(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId, roleIds: scoped }
    )
    expect(targets.map((target) => target.roleId).sort()).toEqual(
      scoped.slice().sort()
    )
  })

  it("collectPrefillTargets still excludes a scoped role that already has a profile", async () => {
    const t = initConvexTest()
    const { orgId, userId, roleIds } = await seedRolesWithEmptyProfiles(t, 2)
    const [first, second] = roleIds
    if (first === undefined || second === undefined) throw new Error("seed")
    await t.run(async (ctx) => {
      await ctx.db.patch(first, {
        purpose: "Already written",
        responsibilities: "Already written",
      })
    })
    const { targets } = await t.query(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId, roleIds: [first, second] }
    )
    expect(targets.map((target) => target.roleId)).toEqual([second])
  })

  it("collectPrefillTargets returns every empty role when no scope is given", async () => {
    const t = initConvexTest()
    const { orgId, userId, roleIds } = await seedRolesWithEmptyProfiles(t, 3)
    const { targets } = await t.query(
      internal.ai.prefillData.collectPrefillTargets,
      { orgId, userId }
    )
    expect(targets).toHaveLength(roleIds.length)
  })
```

Reuse the file's existing seed helper if it has one; otherwise add `seedRolesWithEmptyProfiles(t, count)` returning `{ orgId, userId, roleIds }` by creating an org, a model, and `count` roles through `api.assessment.roles.createRole` with no profile args.

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test --filter=@workspace/backend -- prefill`
Expected: FAIL, `roleIds` is not a valid argument.

- [ ] **Step 3: Add the scope to the internal query**

In `packages/backend/convex/ai/prefillData.ts`, add to `collectPrefillTargets`'s args:

```ts
    // Narrows the prefill to specific roles. Absent means every empty-profile
    // role in the org (onboarding, where the whole register was just created);
    // present means exactly what one in-app import created, so an import never
    // drafts profiles for unrelated roles the user left empty on purpose.
    roleIds: v.optional(v.array(v.id("roles"))),
```

and in the handler, change the filter:

```ts
    const scope =
      roleIds === undefined
        ? null
        : new Set<string>(roleIds.map((id) => id as string))
    const targets = roles
      .filter(
        (role) =>
          role.archivedAt === undefined &&
          !isProfileComplete(role) &&
          (scope === null || scope.has(role._id as string))
      )
```

destructuring `roleIds` from the handler args alongside `orgId`, `userId`, `locale`.

- [ ] **Step 4: Forward it from the action**

In `packages/backend/convex/ai/prefill.ts`, add to the action's args:

```ts
  args: {
    orgId: v.string(),
    locale: v.optional(v.string()),
    roleIds: v.optional(v.array(v.id("roles"))),
  },
```

update the handler signature to `(ctx, { orgId, locale, roleIds })` and the `runQuery` call:

```ts
    const { targets, context, actorId } = await ctx.runQuery(
      internal.ai.prefillData.collectPrefillTargets,
      {
        orgId,
        userId: identity.subject,
        ...(locale !== undefined ? { locale } : {}),
        ...(roleIds !== undefined ? { roleIds } : {}),
      }
    )
```

- [ ] **Step 5: Run the prefill suite**

Run: `bun run test --filter=@workspace/backend -- prefill`
Expected: the three new tests pass and every existing prefill test is untouched (they pass no `roleIds`, so behaviour is identical).

- [ ] **Step 6: Commit**

```bash
git add packages/backend/convex/ai/prefill.ts \
        packages/backend/convex/ai/prefillData.ts \
        packages/backend/convex/ai/prefill.test.ts
git commit -m "feat(roles): scope the profile prefill to specific roles"
```

---

## Phase C: the wizard

### Task 11: `resolveImportTargets`

One pure function decides, for the current draft, which families are existing versus new, which titles are duplicates, and what payload gets submitted. Because the review screen and the payload both read the same result, they cannot disagree.

**Files:**
- Create: `apps/dashboard/lib/role-import.ts`
- Create: `apps/dashboard/lib/role-import.test.ts`

**Interfaces:**
- Consumes: `DraftFamily` from `@/lib/family-dnd`.
- Produces: `resolveImportTargets(draft, existingFamilies, existingRoles): ResolvedImport`, plus the exported types below.

- [ ] **Step 1: Write the failing test**

Create `apps/dashboard/lib/role-import.test.ts`:

```ts
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { describe, expect, it } from "vitest"

import type { DraftFamily } from "@/lib/family-dnd"
import { resolveImportTargets } from "@/lib/role-import"

const ENG = "fam_eng" as Id<"roleFamilies">
const SALES = "fam_sales" as Id<"roleFamilies">

const EXISTING_FAMILIES = [
  { familyId: ENG, name: "Engineering" },
  { familyId: SALES, name: "Sales" },
]

const EXISTING_ROLES = [
  { title: "Developer", familyId: ENG },
  { title: "Account Executive", familyId: SALES },
  // A family-less role must never make a NEW family's title look duplicated.
  { title: "Legal Counsel", familyId: null },
]

function draft(families: DraftFamily[]): DraftFamily[] {
  return families
}

describe("resolveImportTargets", () => {
  it("matches an existing family by name, case-insensitively", () => {
    const result = resolveImportTargets(
      draft([
        { id: 1, name: "engineering", roles: [{ id: 2, title: "SRE", trackKey: "IC" }] },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.familyId).toBe(ENG)
    expect(result.payload).toEqual([
      { familyId: ENG, name: "engineering", roles: [{ title: "SRE", trackKey: "IC" }] },
    ])
    expect(result.counts).toEqual({ roles: 1, families: 0, skipped: 0 })
  })

  it("treats an unmatched name as a new family", () => {
    const result = resolveImportTargets(
      draft([
        { id: 1, name: "Legal", roles: [{ id: 2, title: "Counsel", trackKey: "IC" }] },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.familyId).toBeNull()
    expect(result.payload).toEqual([
      { name: "Legal", roles: [{ title: "Counsel", trackKey: "IC" }] },
    ])
    expect(result.counts).toEqual({ roles: 1, families: 1, skipped: 0 })
  })

  it("flags a title already taken in the matched family and drops it from the payload", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [
            { id: 2, title: " developer ", trackKey: "IC" },
            { id: 3, title: "SRE", trackKey: "IC" },
          ],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles.map((role) => role.duplicate)).toEqual([
      true,
      false,
    ])
    expect(result.payload[0]?.roles).toEqual([{ title: "SRE", trackKey: "IC" }])
    expect(result.counts.skipped).toBe(1)
  })

  it("does not flag a new family's title against a family-less role", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [{ id: 2, title: "Legal Counsel", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles[0]?.duplicate).toBe(false)
  })

  it("flags a duplicate inside one card", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Legal",
          roles: [
            { id: 2, title: "Counsel", trackKey: "IC" },
            { id: 3, title: "COUNSEL", trackKey: "Lead" },
          ],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[0]?.roles.map((role) => role.duplicate)).toEqual([
      false,
      true,
    ])
    expect(result.counts).toEqual({ roles: 1, families: 1, skipped: 1 })
  })

  it("flags a duplicate across two cards that resolve to the SAME existing family", () => {
    const result = resolveImportTargets(
      draft([
        { id: 1, name: "Engineering", roles: [{ id: 2, title: "SRE", trackKey: "IC" }] },
        { id: 3, name: "engineering", roles: [{ id: 4, title: "sre", trackKey: "IC" }] },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families[1]?.roles[0]?.duplicate).toBe(true)
    expect(result.counts.roles).toBe(1)
  })

  it("marks BOTH new families when two of them claim one name, and blocks create", () => {
    const result = resolveImportTargets(
      draft([
        { id: 1, name: "Legal", roles: [{ id: 2, title: "Counsel", trackKey: "IC" }] },
        { id: 3, name: "legal", roles: [{ id: 4, title: "Paralegal", trackKey: "IC" }] },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families.map((family) => family.colliding)).toEqual([
      true,
      true,
    ])
    expect(result.payload).toEqual([])
    expect(result.canCreate).toBe(false)
  })

  it("ignores blank names and blank titles without flagging them", () => {
    const result = resolveImportTargets(
      draft([
        { id: 1, name: "  ", roles: [{ id: 2, title: "Counsel", trackKey: "IC" }] },
        { id: 3, name: "Legal", roles: [{ id: 4, title: "   ", trackKey: "IC" }] },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.families.every((family) => !family.colliding)).toBe(true)
    expect(result.families[1]?.roles[0]?.duplicate).toBe(false)
    expect(result.payload).toEqual([])
    expect(result.canCreate).toBe(false)
  })

  it("cannot create when every proposed role already exists", () => {
    const result = resolveImportTargets(
      draft([
        {
          id: 1,
          name: "Engineering",
          roles: [{ id: 2, title: "Developer", trackKey: "IC" }],
        },
      ]),
      EXISTING_FAMILIES,
      EXISTING_ROLES
    )
    expect(result.canCreate).toBe(false)
    expect(result.counts).toEqual({ roles: 0, families: 0, skipped: 1 })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `bun run test --filter=dashboard -- role-import`
Expected: FAIL, cannot resolve `@/lib/role-import`.

- [ ] **Step 3: Write the resolver**

Create `apps/dashboard/lib/role-import.ts`:

```ts
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import type { DraftFamily } from "@/lib/family-dnd"

// The org's current families and live roles, as the review needs them.
export interface ExistingFamily {
  familyId: Id<"roleFamilies">
  name: string
}

export interface ExistingRole {
  title: string
  familyId: Id<"roleFamilies"> | null
}

export interface ResolvedRole {
  // The draft row's synthetic id, so the review can look its annotation up.
  id: number
  // The title is already taken by a live role in this row's TARGET family (or
  // by an earlier row aimed at the same family), so the import will skip it.
  duplicate: boolean
}

export interface ResolvedFamily {
  id: number
  // Set when the card's name matches an existing family: its roles are added
  // into that family. Null means the card would create a new family.
  familyId: Id<"roleFamilies"> | null
  // Another NEW card in the draft claims the same name. Both are marked, and
  // creating is blocked until one is renamed.
  colliding: boolean
  roles: ResolvedRole[]
}

export interface ImportPayloadFamily {
  familyId?: Id<"roleFamilies">
  name: string
  roles: { title: string; trackKey: string }[]
}

export interface ResolvedImport {
  families: ResolvedFamily[]
  // Exactly what confirmRoleImport should receive.
  payload: ImportPayloadFamily[]
  counts: { roles: number; families: number; skipped: number }
  canCreate: boolean
}

const norm = (value: string) => value.trim().toLowerCase()

// Resolves an edited draft against the org's current register: which cards
// target an existing family, which titles would be skipped as duplicates, and
// what payload the confirm should receive.
//
// Family identity is DERIVED from the name rather than stored on the draft, so
// renaming a card re-targets it live in both directions: onto an existing
// family (a merge) or off it (a new family). Duplicate marking is derived the
// same way, against each role's CURRENT target, so it stays correct after a
// rename or a drag between cards with nothing to keep in sync.
export function resolveImportTargets(
  draft: DraftFamily[],
  existingFamilies: ExistingFamily[],
  existingRoles: ExistingRole[]
): ResolvedImport {
  const familyByName = new Map(
    existingFamilies.map((family) => [norm(family.name), family])
  )

  // Live titles per existing family. Mutated as this pass accepts titles, so
  // two cards resolving to the SAME existing family cannot both claim one
  // title. A family-less role belongs to no card's scope and is skipped here.
  const takenByFamily = new Map<string, Set<string>>()
  for (const role of existingRoles) {
    if (role.familyId === null) continue
    const key = role.familyId as string
    let titles = takenByFamily.get(key)
    if (titles === undefined) {
      titles = new Set<string>()
      takenByFamily.set(key, titles)
    }
    titles.add(norm(role.title))
  }

  // How many NEW cards claim each name, so a collision marks every card
  // involved rather than only the second one.
  const newNameCounts = new Map<string, number>()
  for (const family of draft) {
    const name = norm(family.name)
    if (name === "" || familyByName.has(name)) continue
    newNameCounts.set(name, (newNameCounts.get(name) ?? 0) + 1)
  }

  const families: ResolvedFamily[] = []
  const payload: ImportPayloadFamily[] = []
  let createdRoles = 0
  let createdFamilies = 0
  let skipped = 0

  for (const family of draft) {
    const name = family.name.trim()
    const lowered = norm(name)
    const match = familyByName.get(lowered)
    const familyId = match?.familyId ?? null
    const colliding =
      match === undefined &&
      lowered !== "" &&
      (newNameCounts.get(lowered) ?? 0) > 1

    // An existing family shares one accumulating set across every card aimed
    // at it; a new family only has to avoid repeating itself.
    let taken: Set<string>
    if (familyId !== null) {
      const key = familyId as string
      let existing = takenByFamily.get(key)
      if (existing === undefined) {
        existing = new Set<string>()
        takenByFamily.set(key, existing)
      }
      taken = existing
    } else {
      taken = new Set<string>()
    }

    const roles: ResolvedRole[] = []
    const payloadRoles: { title: string; trackKey: string }[] = []
    for (const role of family.roles) {
      const title = role.title.trim()
      const key = norm(title)
      const duplicate = title !== "" && taken.has(key)
      roles.push({ id: role.id, duplicate })
      if (title === "") continue
      if (duplicate) {
        skipped += 1
        continue
      }
      taken.add(key)
      payloadRoles.push({ title, trackKey: role.trackKey })
    }
    families.push({ id: family.id, familyId, colliding, roles })

    // A colliding card contributes nothing: creating is blocked anyway, and
    // counting its roles would promise something that cannot land.
    if (colliding || name === "" || payloadRoles.length === 0) continue
    payload.push({
      ...(familyId !== null ? { familyId } : {}),
      name,
      roles: payloadRoles,
    })
    createdRoles += payloadRoles.length
    if (familyId === null) createdFamilies += 1
  }

  return {
    families,
    payload,
    counts: { roles: createdRoles, families: createdFamilies, skipped },
    canCreate:
      createdRoles > 0 && families.every((family) => !family.colliding),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test --filter=dashboard -- role-import`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/lib/role-import.ts apps/dashboard/lib/role-import.test.ts
git commit -m "feat(roles): derive additive import targets from the edited draft"
```

---

### Task 12: Annotate `FamiliesReview`

One optional prop. Onboarding passes nothing and renders exactly as before.

**Files:**
- Modify: `apps/dashboard/components/families-review.tsx`
- Modify: `apps/dashboard/components/families-review.test.tsx`

**Interfaces:**
- Consumes: nothing (the annotation values come from Task 11 at the call site).
- Produces: `FamiliesReview` gains

```ts
annotations?: {
  familyBadge: Map<number, "existing" | "new">
  collidingFamilyIds: Set<number>
  nameMissingFamilyIds: Set<number>
  duplicateRoleIds: Set<number>
  labels: {
    existing: string
    new: string
    duplicate: string
    collision: string
    nameMissing: string
  }
}
```

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/components/families-review.test.tsx`:

```tsx
const LABELS = {
  existing: "Existing",
  new: "New",
  duplicate: "Already exists, will be skipped",
  collision: "Two new families cannot share a name.",
}

function AnnotatedHarness({
  initial,
  familyBadge,
  collidingFamilyIds = new Set<number>(),
  duplicateRoleIds = new Set<number>(),
}: {
  initial: DraftFamily[]
  familyBadge: Map<number, "existing" | "new">
  collidingFamilyIds?: Set<number>
  duplicateRoleIds?: Set<number>
}) {
  const [families, setFamilies] = useState(initial)
  const nextId = useRef(100)
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <FamiliesReview
        families={families}
        onFamiliesChange={(updater) =>
          setFamilies((current) => updater(current))
        }
        claimId={() => {
          const id = nextId.current
          nextId.current += 1
          return id
        }}
        trackOptions={TRACKS}
        annotations={{
          familyBadge,
          collidingFamilyIds,
          duplicateRoleIds,
          labels: LABELS,
        }}
      />
    </NextIntlClientProvider>
  )
}

describe("FamiliesReview annotations", () => {
  afterEach(() => {
    cleanup()
  })

  it("badges each family as existing or new", () => {
    render(
      <AnnotatedHarness
        initial={twoFamilies()}
        familyBadge={
          new Map<number, "existing" | "new">([
            [1, "existing"],
            [4, "new"],
          ])
        }
      />
    )
    expect(screen.getByText(LABELS.existing)).toBeTruthy()
    expect(screen.getByText(LABELS.new)).toBeTruthy()
  })

  it("keeps an existing family's name editable so a match can be undone", () => {
    render(
      <AnnotatedHarness
        initial={twoFamilies()}
        familyBadge={new Map<number, "existing" | "new">([[1, "existing"]])}
      />
    )
    const [first] = screen.getAllByLabelText(familyLabel)
    if (first === undefined) throw new Error("no family input")
    expect((first as HTMLInputElement).disabled).toBe(false)
    expect((first as HTMLInputElement).readOnly).toBe(false)
  })

  it("notes a duplicate role and leaves its title editable", () => {
    render(
      <AnnotatedHarness
        initial={twoFamilies()}
        familyBadge={new Map<number, "existing" | "new">([[1, "existing"]])}
        duplicateRoleIds={new Set([2])}
      />
    )
    expect(screen.getAllByText(LABELS.duplicate)).toHaveLength(1)
    const [firstTitle] = screen.getAllByLabelText(titleLabel)
    if (firstTitle === undefined) throw new Error("no title input")
    expect((firstTitle as HTMLInputElement).disabled).toBe(false)
  })

  it("shows the collision message on a colliding family", () => {
    render(
      <AnnotatedHarness
        initial={twoFamilies()}
        familyBadge={new Map<number, "existing" | "new">([[1, "new"]])}
        collidingFamilyIds={new Set([1])}
      />
    )
    expect(screen.getByText(LABELS.collision)).toBeTruthy()
  })

  it("renders no badges and no notes when annotations are absent", () => {
    render(<Harness initial={twoFamilies()} />)
    expect(screen.queryByText(LABELS.existing)).toBeNull()
    expect(screen.queryByText(LABELS.duplicate)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test --filter=dashboard -- families-review`
Expected: FAIL, `annotations` is not a prop.

- [ ] **Step 3: Add the prop and render it**

In `apps/dashboard/components/families-review.tsx`:

Add the type above the component:

```tsx
// Additive-import annotations, derived per render by resolveImportTargets and
// passed in rather than computed here, so this component stays a pure view and
// the onboarding caller (which has no notion of an existing register) can omit
// them entirely. All copy is injected for the same reason.
export interface ReviewAnnotations {
  familyBadge: Map<number, "existing" | "new">
  collidingFamilyIds: Set<number>
  // A family holding real roles but no name. Its roles would otherwise be
  // dropped silently, so the review says so and blocks creating.
  nameMissingFamilyIds: Set<number>
  duplicateRoleIds: Set<number>
  labels: {
    existing: string
    new: string
    duplicate: string
    collision: string
    nameMissing: string
  }
}
```

Add `annotations` to the props and destructure it:

```tsx
  annotations,
}: {
  families: DraftFamily[]
  onFamiliesChange: (updater: FamiliesUpdater) => void
  claimId: () => number
  trackOptions: TrackOption[]
  annotations?: ReviewAnnotations
}) {
```

Add `Badge` to the imports:

```tsx
import { Badge } from "@workspace/ui/components/badge"
```

Replace the `CardHeader` block with:

```tsx
            <CardHeader className="flex flex-row items-start gap-2">
              <div className="flex-1 space-y-1.5">
                <Input
                  aria-label={tFamily("nameLabel")}
                  value={family.name}
                  className="max-w-xs font-medium"
                  onChange={(event) =>
                    updateFamily(family.id, { name: event.target.value })
                  }
                />
                {annotations?.collidingFamilyIds.has(family.id) === true && (
                  <p role="alert" className="text-destructive text-sm">
                    {annotations.labels.collision}
                  </p>
                )}
                {annotations?.nameMissingFamilyIds.has(family.id) === true && (
                  <p role="alert" className="text-destructive text-sm">
                    {annotations.labels.nameMissing}
                  </p>
                )}
              </div>
              {annotations !== undefined && (
                // Fixed-width slot: the badge flips between "existing" and
                // "new" as the name is edited, and a reserved slot keeps that
                // flip from nudging the remove control.
                <div className="flex w-24 shrink-0 justify-end pt-2">
                  {annotations.familyBadge.get(family.id) === "existing" ? (
                    <Badge variant="secondary">
                      {annotations.labels.existing}
                    </Badge>
                  ) : annotations.familyBadge.get(family.id) === "new" ? (
                    <Badge variant="outline">{annotations.labels.new}</Badge>
                  ) : null}
                </div>
              )}
              <RemoveConfirm
                className={annotations === undefined ? "ml-auto" : "mt-1"}
                triggerLabel={t("removeFamilyLabel", { name: family.name })}
                confirmLabel={t("removeFamilyConfirm")}
                cancelLabel={tFamily("cancel")}
                onConfirm={() =>
                  onFamiliesChange((current) =>
                    current.filter((item) => item.id !== family.id)
                  )
                }
              />
            </CardHeader>
```

Pass the duplicate note down to each row:

```tsx
                    <SortableRoleRow
                      key={role.id}
                      role={role}
                      trackOptions={trackOptions}
                      duplicateNote={
                        annotations?.duplicateRoleIds.has(role.id) === true
                          ? annotations.labels.duplicate
                          : null
                      }
```

And in `SortableRoleRow`, accept it and render it. Change the signature to include `duplicateNote: string | null` (typed `duplicateNote?: string | null` is not needed; the parent always passes it, `null` when absent), then wrap the returned row:

```tsx
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("space-y-1", isDragging && "opacity-40")}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          // A duplicate will be skipped by the import, so it reads as inactive
          // while its title still matches. Editing the title clears it.
          duplicateNote !== null && "opacity-60"
        )}
      >
        {/* the existing handle Button, Input, Select and RemoveConfirm,
            unchanged */}
      </div>
      {duplicateNote !== null && (
        // Aligned under the title input (past the drag handle), following the
        // FormMessage precedent for a message that appears under its field.
        <p className="pl-11 text-muted-foreground text-xs">{duplicateNote}</p>
      )}
    </div>
  )
```

Move `isDragging`'s `opacity-40` to the outer wrapper as shown, so a dragged duplicate does not stack two opacities on the same element.

- [ ] **Step 4: Run the tests**

Run: `bun run test --filter=dashboard -- families-review`
Expected: the 5 original plus the 5 annotation tests pass.

- [ ] **Step 5: Run the onboarding suite**

Run: `bun run test --filter=dashboard -- families-step`
Expected: 32 passing. Onboarding passes no `annotations`, so the review must be byte-identical for it.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/components/families-review.tsx \
        apps/dashboard/components/families-review.test.tsx
git commit -m "feat(roles): annotate the families review with existing and duplicate state"
```

---

### Task 13: The `dashboard.roles.import` message namespace

Copy lands before the components that consume it, so every later step can use a real key.

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the `dashboard.roles.import.*` keys used by Tasks 14 to 16.

- [ ] **Step 1: Add the English block**

In `packages/i18n/messages/en.json`, inside `dashboard.roles` (after `"empty"`), add:

```json
      "import": {
        "cta": "Add roles with AI",
        "navLabel": "Import steps",
        "steps": {
          "paste": "Your roles",
          "review": "Review"
        },
        "paste": {
          "heading": "Which roles should we add?",
          "label": "Your roles",
          "hint": "One role per line. Keep your own headings and we keep the grouping.",
          "helpLabel": "About pasting roles",
          "helpBody": "Paste whatever you have: a list of titles, a team-by-team breakdown, or a column from a spreadsheet. We group them into role families, match each role to a track, and add them to families you already have where they fit. Nothing is saved until you confirm.",
          "placeholder1": "Backend Engineer\nSRE\nEngineering Manager",
          "placeholder2": "Sales\n  Account Executive\n  Sales Manager",
          "placeholder3": "Legal Counsel, HR Partner, Controller",
          "cta": "Analyse",
          "error": "The roles could not be read. Try again."
        },
        "generating": "Organizing your roles...",
        "review": {
          "heading": "Review what will be added",
          "hint": "Check the grouping and the tracks. Renaming a family here only decides where the roles go, it does not rename anything you already have.",
          "existingBadge": "Existing",
          "newBadge": "New",
          "duplicate": "Already exists, will be skipped",
          "collision": "Two new families cannot share a name.",
          "nameMissing": "Give this family a name, or its roles will not be added.",
          "cta": "{count, plural, one {Create # role} other {Create # roles}}",
          "nothingToAdd": "Every role here already exists. Edit a title, or start over with a different list.",
          "restart": "Start over",
          "error": "The roles could not be created. Try again."
        },
        "prefilling": {
          "heading": "Drafting job profiles",
          "body": "We are writing a purpose and responsibilities for each new role from its name. This can take a moment.",
          "progress": "{done} of {total} roles"
        },
        "done": {
          "title": "Roles added",
          "description": "Here is what happened.",
          "roles": "Roles added",
          "families": "Families created",
          "skipped": "Already existed",
          "cta": "Go to roles"
        },
        "discard": {
          "title": "Discard this import?",
          "description": "The roles you reviewed will not be created. You can start again at any time.",
          "keep": "Keep reviewing",
          "discard": "Discard"
        }
      },
```

- [ ] **Step 2: Add the Swedish block**

In `packages/i18n/messages/sv.json`, at the same position:

```json
      "import": {
        "cta": "Lägg till roller med AI",
        "navLabel": "Importsteg",
        "steps": {
          "paste": "Dina roller",
          "review": "Granska"
        },
        "paste": {
          "heading": "Vilka roller ska vi lägga till?",
          "label": "Dina roller",
          "hint": "En roll per rad. Har du egna rubriker behåller vi grupperingen.",
          "helpBody": "Klistra in det du har: en lista med titlar, en uppdelning per team eller en kolumn från ett kalkylark. Vi grupperar dem i rollfamiljer, matchar varje roll mot ett spår och lägger dem i familjer du redan har där de passar. Ingenting sparas förrän du bekräftar.",
          "helpLabel": "Om att klistra in roller",
          "placeholder1": "Backend Engineer\nSRE\nEngineering Manager",
          "placeholder2": "Försäljning\n  Account Executive\n  Säljchef",
          "placeholder3": "Bolagsjurist, HR-partner, Controller",
          "cta": "Analysera",
          "error": "Rollerna kunde inte läsas. Försök igen."
        },
        "generating": "Organiserar dina roller...",
        "review": {
          "heading": "Granska vad som läggs till",
          "hint": "Kontrollera grupperingen och spåren. Att byta namn på en familj här styr bara var rollerna hamnar, det byter inte namn på något du redan har.",
          "existingBadge": "Finns",
          "newBadge": "Ny",
          "duplicate": "Finns redan, hoppas över",
          "collision": "Två nya familjer kan inte heta likadant.",
          "nameMissing": "Ge familjen ett namn, annars läggs dess roller inte till.",
          "cta": "{count, plural, one {Skapa # roll} other {Skapa # roller}}",
          "nothingToAdd": "Alla roller här finns redan. Ändra en titel, eller börja om med en annan lista.",
          "restart": "Börja om",
          "error": "Rollerna kunde inte skapas. Försök igen."
        },
        "prefilling": {
          "heading": "Skapar rollprofiler",
          "body": "Vi skriver ett syfte och ansvarsområden för varje ny roll utifrån dess namn. Det kan ta en stund.",
          "progress": "{done} av {total} roller"
        },
        "done": {
          "title": "Roller tillagda",
          "description": "Så här gick det.",
          "roles": "Roller tillagda",
          "families": "Familjer skapade",
          "skipped": "Fanns redan",
          "cta": "Till roller"
        },
        "discard": {
          "title": "Kasta den här importen?",
          "description": "Rollerna du granskat skapas inte. Du kan börja om när som helst.",
          "keep": "Fortsätt granska",
          "discard": "Kasta"
        }
      },
```

Note the placeholder phrases keep international job titles in English where that is what a Swedish HR team actually writes (`Account Executive`, `Backend Engineer`, `Controller`); this matches the existing convention in the onboarding placeholders. Read `dashboard.onboarding.families.placeholderPhrase1-3` in each locale and follow whatever mix it already uses.

- [ ] **Step 3: Add the Norwegian, Danish and Finnish blocks**

Mirror the same key tree into `nb.json`, `da.json` and `fi.json`. Do not invent a house style: for each key, follow the wording the same file already uses for its nearest neighbours, specifically `dashboard.people.import.*` (an existing import wizard, so it already has `discard`, `done`, `steps` and back-navigation copy in every locale) and `dashboard.onboarding.families.*` (the paste view, the review hint, the prefilling screen). Domain terms must match each file's existing choices: whatever that file already calls a role family, a track, and a job profile.

Use Write/Edit only. Do not pipe these strings through `perl`, `sed`, or `echo`: it double-encodes the diacritics and the parity test will not catch it because it compares key sets, not values.

Mark all four as machine-translated drafts needing native review when presenting the work.

- [ ] **Step 4: Verify parity and encoding**

Run: `bun run test --filter=@workspace/i18n`
Expected: the parity test passes, meaning all five files have identical key sets.

Run: `grep -n "Ã¤\|Ã¶\|Ã¥\|Ã¦\|Ã¸\|Ã©\|â€" packages/i18n/messages/*.json`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add packages/i18n/messages/*.json
git commit -m "feat(roles): add the role import copy in every locale"
```

---

### Task 14: `useRoleImportFlow`

The thin additive flow: it composes the two shared hooks, resolves the draft against the register every render, and owns the confirm plus the phase machine.

**Files:**
- Create: `apps/dashboard/hooks/use-role-import-flow.ts`

**Interfaces:**
- Consumes: `usePastedRoleDraft` (Task 4), `useProfilePrefill` and `prefillProgressOf` (Task 3), `resolveImportTargets` (Task 11), `confirmRoleImport` and `requestRoleImport` (Tasks 8 and 9).
- Produces:

```ts
type RoleImportPhase = "paste" | "generating" | "loading" | "review" | "prefilling" | "done"

interface RoleImportFlow {
  phase: RoleImportPhase
  pasted: PastedRoleDraft
  resolved: ResolvedImport
  annotations: ReviewAnnotations
  pending: boolean
  failure: "duplicate" | "generic" | null
  result: { familyCount: number; roleCount: number; skippedCount: number } | null
  prefillProgress: PrefillProgress
  create: () => Promise<void>
  restart: () => void
}

useRoleImportFlow(options: { orgId: string }): RoleImportFlow
```

- [ ] **Step 1: Write the hook**

Create `apps/dashboard/hooks/use-role-import-flow.ts`:

```ts
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { SUGGESTION_KINDS } from "@workspace/constants"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import type { ReviewAnnotations } from "@/components/families-review"
import {
  type PastedRoleDraft,
  usePastedRoleDraft,
} from "@/hooks/use-pasted-role-draft"
import {
  type PrefillProgress,
  prefillProgressOf,
  useProfilePrefill,
} from "@/hooks/use-profile-prefill"
import { isDuplicateFamilyError } from "@/lib/family-error"
import { type ResolvedImport, resolveImportTargets } from "@/lib/role-import"

export type RoleImportPhase =
  | "paste"
  | "generating"
  | "loading"
  | "review"
  | "prefilling"
  | "done"

export interface RoleImportFlow {
  phase: RoleImportPhase
  pasted: PastedRoleDraft
  resolved: ResolvedImport
  annotations: ReviewAnnotations
  // True across confirm + prefill, so the review's CTA stays inert.
  pending: boolean
  failure: "duplicate" | "generic" | null
  result: {
    familyCount: number
    roleCount: number
    skippedCount: number
  } | null
  prefillProgress: PrefillProgress
  create: () => Promise<void>
  restart: () => void
}

// The in-app role import flow. Purely additive, so it has none of onboarding's
// extra machinery: no industry template, no resume-from-existing, no reconcile.
// What it adds instead is the existing register, which every render is resolved
// against the edited draft so the review and the submitted payload are the same
// derivation.
export function useRoleImportFlow(options: { orgId: string }): RoleImportFlow {
  const { orgId } = options
  const locale = useLocale()
  const t = useTranslations("dashboard.roles.import.review")

  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const existingFamilies = useQuery(
    api.assessment.families.listRoleFamilies,
    { orgId, locale }
  )
  const existingRoles = useQuery(api.assessment.roles.listRoles, {
    orgId,
    locale,
  })
  const requestRoleImport = useMutation(api.ai.suggest.requestRoleImport)
  const confirmRoleImport = useMutation(api.ai.suggest.confirmRoleImport)
  const prefill = useProfilePrefill({ orgId })

  // The register has to be loaded before a proposal may seed the review:
  // resolving against an empty register would show every family as new and
  // every title as fresh, then quietly change under the user.
  const registerReady =
    model !== undefined &&
    model !== null &&
    existingFamilies !== undefined &&
    existingRoles !== undefined

  const pasted = usePastedRoleDraft({
    orgId,
    locale,
    kind: SUGGESTION_KINDS.roleImport,
    request: requestRoleImport,
    tracks: model?.tracks,
    canSeed: registerReady,
  })

  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<"duplicate" | "generic" | null>(null)
  const [createdRoleIds, setCreatedRoleIds] = useState<Id<"roles">[] | null>(
    null
  )
  const [result, setResult] = useState<RoleImportFlow["result"]>(null)

  const resolved = resolveImportTargets(
    pasted.draft.families ?? [],
    (existingFamilies ?? []).map((family) => ({
      familyId: family.familyId,
      name: family.name,
    })),
    (existingRoles ?? []).map((role) => ({
      title: role.title,
      familyId: role.familyId,
    }))
  )

  const annotations: ReviewAnnotations = {
    familyBadge: new Map(
      resolved.families.map((family) => [
        family.id,
        family.familyId !== null ? ("existing" as const) : ("new" as const),
      ])
    ),
    collidingFamilyIds: new Set(
      resolved.families
        .filter((family) => family.colliding)
        .map((family) => family.id)
    ),
    nameMissingFamilyIds: new Set(
      resolved.families
        .filter((family) => family.nameMissing)
        .map((family) => family.id)
    ),
    duplicateRoleIds: new Set(
      resolved.families.flatMap((family) =>
        family.roles.filter((role) => role.duplicate).map((role) => role.id)
      )
    ),
    labels: {
      existing: t("existingBadge"),
      new: t("newBadge"),
      duplicate: t("duplicate"),
      collision: t("collision"),
      nameMissing: t("nameMissing"),
    },
  }

  // A proposal that arrived while the register was still loading must not drop
  // the user back to the paste view: hold until the seed can run.
  const holdingForRegister =
    !registerReady && pasted.flow.status === "suggested"

  const phase: RoleImportPhase = pending
    ? prefill.prefilling
      ? "prefilling"
      : "review"
    : result !== null
      ? "done"
      : pasted.seededSuggestionId !== null && pasted.draft.families !== null
        ? "review"
        : pasted.flow.status === "generating"
          ? "generating"
          : holdingForRegister
            ? "loading"
            : "paste"

  return {
    phase,
    pasted,
    resolved,
    annotations,
    pending,
    failure,
    result,
    // Measures only what this import created, so the bar reflects this run and
    // not whatever else in the org happens to lack a profile.
    prefillProgress: prefillProgressOf(
      existingRoles,
      createdRoleIds ?? undefined
    ),
    create: async () => {
      const suggestionId = pasted.seededSuggestionId
      if (suggestionId === null || !resolved.canCreate || pending) return
      setPending(true)
      setFailure(null)
      try {
        const outcome = await confirmRoleImport({
          orgId,
          suggestionId,
          families: resolved.payload,
        })
        setCreatedRoleIds(outcome.createdRoleIds)
        setResult({
          familyCount: outcome.familyCount,
          roleCount: outcome.roleCount,
          skippedCount: outcome.skippedCount,
        })
        // Draft the profiles for exactly these roles, so an imported role is
        // evaluatable straight away (the rate step is gated on a complete
        // profile) without touching any other empty role in the org.
        await prefill.run({
          locale,
          willPrefill: outcome.createdRoleIds.length > 0,
          roleIds: outcome.createdRoleIds,
        })
      } catch (error) {
        // A hard prefill reject lands here too. The roles were still created,
        // so the result stays set and the done screen reports them; the profile
        // is then drafted per role from the role page.
        setFailure(isDuplicateFamilyError(error) ? "duplicate" : "generic")
      } finally {
        setPending(false)
      }
    },
    restart: () => {
      setFailure(null)
      pasted.dismiss()
    },
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `bun run typecheck`
Expected: green. `isDuplicateFamilyError` already exists in `apps/dashboard/lib/family-error.ts`; if `listRoleFamilies` returns a different field name than `familyId`/`name`, read `packages/backend/convex/assessment/families.ts` and adjust the two mapping callbacks only.

- [ ] **Step 3: Commit**

The flow has no test of its own: it is exercised end to end through the wizard in Task 15, which is where its phases are observable. Commit it together with the wizard rather than alone.

Proceed to Task 15 without committing.

---

### Task 15: The wizard and its route

**Files:**
- Create: `apps/dashboard/components/roles/import/role-import-wizard.tsx`
- Create: `apps/dashboard/components/roles/import/role-import-wizard.test.tsx`
- Create: `apps/dashboard/app/(app)/roles/import/page.tsx`

**Interfaces:**
- Consumes: `useRoleImportFlow` (Task 14), `FamiliesReview` + `ReviewAnnotations` (Task 12), `PastedRolesField` (Task 2), the `dashboard.roles.import.*` keys (Task 13).
- Produces: the route `/roles/import`.

- [ ] **Step 1: Write the wizard**

Create `apps/dashboard/components/roles/import/role-import-wizard.tsx`:

```tsx
"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Button } from "@workspace/ui/components/button"
import { Progress } from "@workspace/ui/components/progress"
import { Spinner } from "@workspace/ui/components/spinner"
import { AnimatePresence, motion } from "motion/react"
import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FamiliesReview } from "@/components/families-review"
import { NextButton } from "@/components/onboarding/next-button"
import { OnboardingDots } from "@/components/onboarding/onboarding-dots"
import { WizardFooter } from "@/components/onboarding/wizard-footer"
import { useOrganization } from "@/components/org-context"
import { PastedRolesField } from "@/components/pasted-roles-field"
import { ScreenShell } from "@/components/screen-shell"
import { SuccessCheck } from "@/components/success-check"
import { WizardShell } from "@/components/wizard-shell"
import { useRoleImportFlow } from "@/hooks/use-role-import-flow"

// The in-app role import: paste a list, review what the AI proposes against the
// register you already have, create. A full-screen takeover like the people
// import, because the review needs the width and the flow owns the screen.
export function RoleImportWizard() {
  const t = useTranslations("dashboard.roles.import")
  const tDetail = useTranslations("dashboard.roles.detail")
  const tErrors = useTranslations("errors")
  const router = useRouter()
  const { orgId } = useOrganization()
  const flow = useRoleImportFlow({ orgId })

  const [discardOpen, setDiscardOpen] = useState(false)

  // Nothing is written until Create, so leaving is a clean discard, but a
  // reviewed list represents real work: warn before dropping it. Once the
  // import has completed, leaving is free again.
  const hasProgress = flow.phase === "review" && flow.result === null

  // Covers reload and tab close. In-app browser Back is not interceptable in
  // the App Router; the exit control below covers the deliberate case.
  useEffect(() => {
    if (!hasProgress) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => {
      window.removeEventListener("beforeunload", handler)
    }
  }, [hasProgress])

  const steps = [
    { key: "step-0", label: t("steps.paste") },
    { key: "step-1", label: t("steps.review") },
  ]
  const stepIndex =
    flow.phase === "review" ||
    flow.phase === "prefilling" ||
    flow.phase === "done"
      ? 1
      : 0

  function leave() {
    if (hasProgress) {
      setDiscardOpen(true)
      return
    }
    router.push("/roles")
  }

  return (
    <>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("discard.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("discard.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("discard.keep")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/roles")}>
              {t("discard.discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <WizardShell
        headerLeft={
          <Button variant="ghost" size="sm" onClick={leave}>
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
            {tDetail("backToRoles")}
          </Button>
        }
        contentClassName="max-w-3xl"
        contentKey={flow.phase}
        footer={
          <OnboardingDots
            steps={steps}
            activeIndex={stepIndex}
            maxReachedIndex={stepIndex}
            navLabel={t("navLabel")}
            // The review is reached by generating, not by clicking a dot, and
            // going back to paste is what Start over is for.
            onSelect={() => {}}
          />
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={flow.phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {renderPhase()}
          </motion.div>
        </AnimatePresence>
      </WizardShell>
    </>
  )

  // Plain render helpers, NOT components: a component defined inside the parent
  // gets a new identity every render and would remount the subtree (the
  // textarea would drop focus on every keystroke).
  function renderPhase() {
    if (flow.phase === "done") return renderDone()
    if (flow.phase === "prefilling") return renderPrefilling()
    if (flow.phase === "review") return renderReview()
    if (flow.phase === "generating") {
      return (
        <ScreenShell heading={t("paste.heading")} align="start">
          <p className="flex items-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            {t("generating")}
          </p>
        </ScreenShell>
      )
    }
    if (flow.phase === "loading") {
      return (
        <main className="flex items-center justify-center p-6">
          <Spinner aria-label={t("generating")} />
        </main>
      )
    }
    return renderPaste()
  }

  function renderPaste() {
    const { pasted } = flow
    return (
      <ScreenShell heading={t("paste.heading")} align="start">
        <PastedRolesField
          id="role-import-text"
          value={pasted.rawText}
          onChange={pasted.setRawText}
          label={t("paste.label")}
          helpLabel={t("paste.helpLabel")}
          helpBody={t("paste.helpBody")}
          hint={t("paste.hint")}
          placeholderPhrases={[
            t("paste.placeholder1"),
            t("paste.placeholder2"),
            t("paste.placeholder3"),
          ]}
        />
        <WizardFooter>
          <NextButton
            label={t("paste.cta")}
            disabled={pasted.requestPending || !pasted.inputValid}
            onClick={() => pasted.analyze()}
          />
        </WizardFooter>
        {/* Alerts extend below the CTA so nothing on screen reflows. */}
        {(pasted.requestFailed || pasted.flow.status === "failed") && (
          <p role="alert" className="text-destructive text-sm">
            {pasted.requestFailed
              ? t("paste.error")
              : tErrors(pasted.flow.errorSubKey ?? "aiGenerationFailed")}
          </p>
        )}
      </ScreenShell>
    )
  }

  function renderReview() {
    const { pasted, resolved, annotations } = flow
    return (
      <ScreenShell heading={t("review.heading")} align="start">
        <p className="text-muted-foreground text-sm">{t("review.hint")}</p>
        <FamiliesReview
          families={pasted.draft.families ?? []}
          onFamiliesChange={pasted.draft.update}
          claimId={pasted.draft.claimId}
          trackOptions={pasted.trackOptions}
          annotations={annotations}
        />
        <WizardFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={flow.pending}
            onClick={flow.restart}
          >
            {t("review.restart")}
          </Button>
          <Button
            type="button"
            disabled={!resolved.canCreate || flow.pending}
            onClick={() => flow.create()}
          >
            {t("review.cta", { count: resolved.counts.roles })}
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              aria-hidden="true"
            />
          </Button>
        </WizardFooter>
        {/* Below the CTA, so neither message reflows the list above it. */}
        {resolved.counts.roles === 0 &&
          resolved.families.every((family) => !family.colliding) && (
            <p className="text-muted-foreground text-sm">
              {t("review.nothingToAdd")}
            </p>
          )}
        {flow.failure !== null && (
          <p role="alert" className="text-destructive text-sm">
            {flow.failure === "duplicate"
              ? tErrors("roleFamilyExists")
              : t("review.error")}
          </p>
        )}
      </ScreenShell>
    )
  }

  function renderPrefilling() {
    const { done, total } = flow.prefillProgress
    const percent = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
        <div className="space-y-1">
          <p className="flex items-center justify-center gap-2 font-medium text-base">
            <Spinner />
            {t("prefilling.heading")}
          </p>
          <p className="text-muted-foreground text-sm">
            {t("prefilling.body")}
          </p>
        </div>
        {/* The drafting bar wears the rose brand accent, matching the same
            moment in onboarding; other progress bars stay neutral. */}
        <Progress
          value={percent}
          className="[&>[data-slot=progress-indicator]]:bg-brand"
        />
        <p className="text-muted-foreground text-sm">
          {t("prefilling.progress", { done, total })}
        </p>
      </div>
    )
  }

  function renderDone() {
    const result = flow.result
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex justify-center">
          <SuccessCheck />
        </div>
        <ScreenShell heading={t("done.title")} description={t("done.description")}>
          <dl className="w-full space-y-2">
            <div className="flex items-center justify-between border-b py-2">
              <dt className="text-muted-foreground text-sm">{t("done.roles")}</dt>
              <dd className="font-medium text-sm">{result?.roleCount ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <dt className="text-muted-foreground text-sm">
                {t("done.families")}
              </dt>
              <dd className="font-medium text-sm">
                {result?.familyCount ?? 0}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted-foreground text-sm">
                {t("done.skipped")}
              </dt>
              <dd className="font-medium text-sm">
                {result?.skippedCount ?? 0}
              </dd>
            </div>
          </dl>
          <WizardFooter>
            <Button type="button" onClick={() => router.push("/roles")}>
              {t("done.cta")}
            </Button>
          </WizardFooter>
          {flow.failure !== null && (
            <p role="alert" className="text-destructive text-sm">
              {t("review.error")}
            </p>
          )}
        </ScreenShell>
      </div>
    )
  }
}
```

- [ ] **Step 2: Add the route**

Create `apps/dashboard/app/(app)/roles/import/page.tsx`:

```tsx
import { RoleImportWizard } from "@/components/roles/import/role-import-wizard"

// Full-screen takeover, like the people import. The wizard's WizardShell is a
// h-svh frame, so inside the app shell's padded content column it gets
// squished; a fixed, full-viewport layer lets it fill the screen and cover the
// sidebar/header. It stays inside AppShell's React tree, so the wizard keeps
// the OrganizationProvider context (orgId) it needs. Exit is the wizard's own
// "back to roles" control (the shell nav is hidden here).
export default function RolesImportPage() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <RoleImportWizard />
    </div>
  )
}
```

- [ ] **Step 3: Write the wizard test**

Create `apps/dashboard/components/roles/import/role-import-wizard.test.tsx`:

```tsx
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mockAction, mockMutation, onQuery } from "@/test/convex-mocks"

const requestRoleImportMock = mockMutation("ai.suggest.requestRoleImport")
const confirmRoleImportMock = mockMutation("ai.suggest.confirmRoleImport")
const rejectSuggestionMock = mockMutation("ai.suggest.rejectSuggestion")
const prefillMock = mockAction("ai.prefill.prefillRoleProfiles")
const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

const pushMock = vi.fn()

vi.mock("convex/react", async () => {
  return (await import("@/test/convex-mocks")).convexReactModule
})
vi.mock("@workspace/backend/convex/_generated/api", async () => {
  return (await import("@/test/convex-mocks")).apiModule
})
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1" }),
}))
vi.mock("@/components/typewriter-placeholder", () => ({
  TypewriterPlaceholder: () => null,
}))

import { RoleImportWizard } from "@/components/roles/import/role-import-wizard"

const t = messages.dashboard.roles.import

function modelFixture() {
  return {
    modelId: "model-1",
    name: "Standard",
    templateKey: "standard",
    criteria: [],
    tracks: [
      { key: "IC", name: "Individual Contributor", order: 1 },
      { key: "Lead", name: "Lead", order: 2 },
    ],
    bandThresholds: [],
  }
}

// The org already has Engineering with a Developer in it, which is what makes
// this an additive import rather than a starter set.
function familiesFixture() {
  return [{ familyId: "fam-eng", name: "Engineering", roleCount: 1 }]
}

function rolesFixture() {
  return [
    {
      roleId: "role-dev",
      title: "Developer",
      trackKey: "IC",
      familyId: "fam-eng",
      familyName: "Engineering",
      profileComplete: true,
    },
  ]
}

// A proposal that lands one new role in the existing family, one duplicate of
// what is already there, and one role in a brand-new family.
function suggestionFixture() {
  return [
    {
      suggestionId: "sugg-1",
      kind: "role.import",
      status: "suggested",
      suggestedValue: {
        families: [
          {
            name: "Engineering",
            roles: [
              { title: "SRE", trackKey: "IC" },
              { title: "Developer", trackKey: "IC" },
            ],
          },
          { name: "Legal", roles: [{ title: "Legal Counsel", trackKey: "IC" }] },
        ],
      },
      errorCode: null,
      createdAt: 1,
      roleId: null,
    },
  ]
}

let currentSuggestions: unknown

function renderWizard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RoleImportWizard />
    </NextIntlClientProvider>
  )
}

describe("RoleImportWizard", () => {
  beforeEach(() => {
    requestRoleImportMock.mockReset()
    requestRoleImportMock.mockResolvedValue("sugg-1")
    confirmRoleImportMock.mockReset()
    rejectSuggestionMock.mockReset()
    rejectSuggestionMock.mockResolvedValue(null)
    prefillMock.mockReset()
    prefillMock.mockResolvedValue({ generated: 0, failed: 0 })
    pushMock.mockReset()
    currentSuggestions = []
    useQueryMock.mockReset()
    useQueryMock.mockImplementation((ref: unknown) => {
      if (ref === "ai.suggest.getOpenSuggestions") return currentSuggestions
      if (ref === "assessment.families.listRoleFamilies")
        return familiesFixture()
      if (ref === "assessment.roles.listRoles") return rolesFixture()
      return modelFixture()
    })
  })

  afterEach(() => {
    cleanup()
  })

  it("starts on the paste step with the analyse CTA disabled", () => {
    renderWizard()
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
    const cta = screen.getByRole("button", { name: t.paste.cta })
    expect((cta as HTMLButtonElement).disabled).toBe(true)
  })

  it("sends the pasted text on analyse", async () => {
    renderWizard()
    fireEvent.change(screen.getByLabelText(t.paste.label), {
      target: { value: "SRE\nLegal Counsel" },
    })
    fireEvent.click(screen.getByRole("button", { name: t.paste.cta }))
    await waitFor(() => {
      expect(requestRoleImportMock).toHaveBeenCalledWith({
        orgId: "org-1",
        rawText: "SRE\nLegal Counsel",
        locale: "en",
      })
    })
  })

  it("badges a matched family as existing and a fresh one as new", () => {
    currentSuggestions = suggestionFixture()
    renderWizard()
    expect(screen.getByText(t.review.existingBadge)).toBeTruthy()
    expect(screen.getByText(t.review.newBadge)).toBeTruthy()
  })

  it("marks the already-present title and excludes it from the count", () => {
    currentSuggestions = suggestionFixture()
    renderWizard()
    expect(screen.getAllByText(t.review.duplicate)).toHaveLength(1)
    // SRE plus Legal Counsel land; Developer is skipped.
    expect(
      screen.getByRole("button", { name: /Create 2 roles/ })
    ).toBeTruthy()
  })

  it("submits the resolved payload, merging into the existing family", async () => {
    currentSuggestions = suggestionFixture()
    confirmRoleImportMock.mockResolvedValue({
      createdRoleIds: ["role-sre", "role-counsel"],
      familyCount: 1,
      roleCount: 2,
      skippedCount: 1,
    })
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: /Create 2 roles/ }))
    await waitFor(() => {
      expect(confirmRoleImportMock).toHaveBeenCalledWith({
        orgId: "org-1",
        suggestionId: "sugg-1",
        families: [
          {
            familyId: "fam-eng",
            name: "Engineering",
            roles: [{ title: "SRE", trackKey: "IC" }],
          },
          {
            name: "Legal",
            roles: [{ title: "Legal Counsel", trackKey: "IC" }],
          },
        ],
      })
    })
  })

  it("prefills only the created roles, then shows the done counts", async () => {
    currentSuggestions = suggestionFixture()
    confirmRoleImportMock.mockResolvedValue({
      createdRoleIds: ["role-sre", "role-counsel"],
      familyCount: 1,
      roleCount: 2,
      skippedCount: 1,
    })
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: /Create 2 roles/ }))
    await waitFor(() => {
      expect(prefillMock).toHaveBeenCalledWith({
        orgId: "org-1",
        locale: "en",
        roleIds: ["role-sre", "role-counsel"],
      })
    })
    expect(await screen.findByText(t.done.title)).toBeTruthy()
    expect(screen.getByText(t.done.skipped)).toBeTruthy()
  })

  it("blocks create and explains when every proposed role already exists", () => {
    currentSuggestions = [
      {
        ...suggestionFixture()[0],
        suggestedValue: {
          families: [
            {
              name: "Engineering",
              roles: [{ title: "Developer", trackKey: "IC" }],
            },
          ],
        },
      },
    ]
    renderWizard()
    expect(screen.getByText(t.review.nothingToAdd)).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: /Create 0 roles/,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it("start over dismisses the proposal and returns to the paste step", async () => {
    currentSuggestions = suggestionFixture()
    renderWizard()
    fireEvent.click(screen.getByRole("button", { name: t.review.restart }))
    await waitFor(() => {
      expect(rejectSuggestionMock).toHaveBeenCalledWith({
        orgId: "org-1",
        suggestionId: "sugg-1",
      })
    })
    expect(screen.getByText(t.paste.heading)).toBeTruthy()
  })

  it("leaves straight to roles from the untouched paste step", () => {
    renderWizard()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.roles.detail.backToRoles,
      })
    )
    expect(pushMock).toHaveBeenCalledWith("/roles")
  })

  it("confirms before leaving a reviewed list", () => {
    currentSuggestions = suggestionFixture()
    renderWizard()
    fireEvent.click(
      screen.getByRole("button", {
        name: messages.dashboard.roles.detail.backToRoles,
      })
    )
    expect(pushMock).not.toHaveBeenCalled()
    expect(screen.getByText(t.discard.title)).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run the wizard test**

Run: `bun run test --filter=dashboard -- role-import-wizard`
Expected: 10 passing. If the `Create N roles` accessible name does not match the regex, read the compiled ICU output for `dashboard.roles.import.review.cta` and use `screen.getByRole("button", { name: /Create/ })` scoped by the footer instead.

- [ ] **Step 5: Commit the flow, the wizard and the route together**

```bash
git add apps/dashboard/hooks/use-role-import-flow.ts \
        apps/dashboard/components/roles/import/role-import-wizard.tsx \
        apps/dashboard/components/roles/import/role-import-wizard.test.tsx \
        "apps/dashboard/app/(app)/roles/import/page.tsx"
git commit -m "feat(roles): add the AI role import wizard"
```

---

### Task 16: Reach it from the roles page

**Files:**
- Modify: `apps/dashboard/components/roles/create-role-dialog.tsx`
- Modify: `apps/dashboard/app/(app)/roles/page.tsx`
- Modify: `apps/dashboard/components/roles/create-role-dialog.test.tsx`

**Interfaces:**
- Consumes: the `/roles/import` route (Task 15) and `dashboard.roles.import.cta` (Task 13).
- Produces: `CreateRoleDialog` gains `triggerVariant?: React.ComponentProps<typeof Button>["variant"]`.

- [ ] **Step 1: Write the failing test**

Append to `apps/dashboard/components/roles/create-role-dialog.test.tsx`:

```tsx
  it("renders its trigger as the default primary button", () => {
    renderDialog()
    const trigger = screen.getByRole("button", { name: TRIGGER_LABEL })
    expect(trigger.className).not.toContain("border")
  })

  it("renders its trigger in the requested variant", () => {
    renderDialog({ triggerVariant: "outline" })
    const trigger = screen.getByRole("button", { name: TRIGGER_LABEL })
    expect(trigger.className).toContain("border")
  })
```

Adapt `renderDialog` to accept and forward extra props, and reuse whatever the file already calls its trigger label constant.

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test --filter=dashboard -- create-role-dialog`
Expected: FAIL, the outline case still renders the default variant.

- [ ] **Step 3: Add the prop**

In `apps/dashboard/components/roles/create-role-dialog.tsx`, add to the props:

```tsx
  // The roles page demotes this to the secondary action beside the import, the
  // way the people header does. Defaults to the primary button everywhere else
  // (the family page keeps it as its main action).
  triggerVariant,
```

```tsx
  triggerVariant?: React.ComponentProps<typeof Button>["variant"]
```

and change the trigger:

```tsx
        <DialogTrigger render={<Button variant={triggerVariant} />}>
          {triggerLabel}
        </DialogTrigger>
```

- [ ] **Step 4: Wire the roles page**

In `apps/dashboard/app/(app)/roles/page.tsx`, add the imports:

```tsx
import { buttonVariants } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import Link from "next/link"
```

Replace the loading branch's `action` with the real controls (both labels are static i18n text, so neither is a gray bar, and the import link works immediately):

```tsx
        <PageHeader
          title={t("heading")}
          description={t("description")}
          action={
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline">
                {t("newCta")}
              </Button>
              <Link href="/roles/import" className={cn(buttonVariants())}>
                <HugeiconsIcon
                  icon={Briefcase01Icon}
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {t("import.cta")}
              </Link>
            </div>
          }
        />
```

Replace the loaded branch's `action` with:

```tsx
        action={
          // Import is the primary: a register is built fastest in bulk, and
          // this matches the people header, where the bulk path also leads.
          <div className="flex items-center gap-2">
            <CreateRoleDialog
              orgId={orgId}
              tracks={model.tracks}
              triggerLabel={t("newCta")}
              existing={roles}
              triggerVariant="outline"
            />
            <Link href="/roles/import" className={cn(buttonVariants())}>
              <HugeiconsIcon
                icon={Briefcase01Icon}
                size={16}
                strokeWidth={2}
                aria-hidden="true"
              />
              {t("import.cta")}
            </Link>
          </div>
        }
```

And give the zero-roles `Empty` a way forward, mirroring the people empty state. After the closing `</EmptyHeader>`:

```tsx
          <Link
            href="/roles/import"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            {t("import.cta")}
          </Link>
```

- [ ] **Step 5: Run the affected tests**

Run: `bun run test --filter=dashboard -- create-role-dialog roles`
Expected: green.

- [ ] **Step 6: Full verification**

Run: `bun run test` then `bun run typecheck` then `bunx biome check .`
Expected: all green across every package.

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/components/roles/create-role-dialog.tsx \
        apps/dashboard/components/roles/create-role-dialog.test.tsx \
        "apps/dashboard/app/(app)/roles/page.tsx"
git commit -m "feat(roles): reach the AI role import from the role register"
```

---

### Task 17: Record the transaction-size note

**Files:**
- Modify: `docs/go-live-checklist.md`

- [ ] **Step 1: Extend the chunking entry**

In the `Chunk the remaining org-scaled single-transaction writes` item, add:

```markdown
  Same class, payload-bounded rather than org-bounded: `insertStarterSet` and
  `insertAdditiveRoles` (assessment/starters.ts) each write up to 20 families
  plus 100 roles plus roughly 120 audit rows and their aggregate updates in ONE
  transaction. The cap is a payload constant (`MAX_FAMILIES` / `MAX_ROLES`), not
  the org's size, so this does not grow with a large customer; what does grow is
  the READ side, which collects every role in the org to check title uniqueness
  (the same pattern `reconcileStarterSet` and `assertUniqueRoleTitle` already
  use). Verify the write count against Convex's per-transaction document limits
  at a full 100-role import before large-org onboarding, and bound the
  uniqueness read if a register ever reaches thousands of roles.
```

- [ ] **Step 2: Commit**

```bash
git add docs/go-live-checklist.md
git commit -m "docs: record the role-import transaction size against the chunking item"
```

---

## Manual verification

The Convex dev deployment is where the AI path is actually exercised; the tests mock the model.

- [ ] Run `bun run dev` and sign in to an org that already has roles.
- [ ] From `/roles`, confirm the header shows `New role` (outline) beside `Add roles with AI` (filled), and that the latter opens a full-screen wizard with no sidebar bleeding through.
- [ ] Paste a list mixing roles that exist and roles that do not, including one that belongs in an existing family. Confirm the review badges that family `Existing`, marks the known title as a duplicate, and counts only what will land.
- [ ] Rename the `Existing` family card to something new and watch the badge flip to `New`; rename it back and watch the merge return.
- [ ] Drag a role from a new family into the existing one and confirm its duplicate state re-derives.
- [ ] Create, watch the prefill bar, and confirm the done counts. Then check `/roles` shows the new roles with complete profiles and that no unrelated empty role gained one.
- [ ] Open the audit log and confirm the import row reads as localized text with the family and role counts, not a raw payload.
- [ ] Switch the display language to Swedish and repeat the paste: the generated family names, role titles and drafted profiles must all come back in Swedish.
- [ ] Reload mid-generation and confirm the wizard resumes into the review rather than an empty paste view.

## Self-review notes

Checked against the spec:

- Every spec section maps to a task. Purely-additive semantics is Task 8; paste-only input is Task 15's paste step; scoped prefill is Tasks 10 and 14; the extended review is Tasks 12 and 11; roles-page-only entry with import as primary is Task 16.
- The two pre-existing bugs the spec commits to are Task 5 (`AI_KIND_KEY` totality, which also fixes the missing `role.profile` label) and Task 7 (reserved role slugs).
- One naming correction was applied to the spec while planning: the audit payload field is `skippedCount`, not `skipped`, because `AiConfirmedPayload`'s `model.weightReview` variant already uses that spelling and the union is compile-guarded.
- Type consistency: `skippedCount` is used identically in `AdditiveImportResult`, `confirmRoleImport`'s return validator, `RoleImportFlow["result"]`, and the wizard's done screen. `roleTitleKey` has one signature, used by `assertUniqueRoleTitle` and `insertAdditiveRoles`. `ReviewAnnotations` is defined once in `families-review.tsx` and imported by `use-role-import-flow.ts`.
- Deliberate deviation from the skill's default: Task 13 gives `en` and `sv` in full and specifies `nb`/`da`/`fi` by reference to the neighbouring blocks each file already has. Machine translations authored here would carry no more accuracy than the implementer's and would risk baking in errors; the key tree, the English source, and the per-file conventions to follow are all stated exactly.
