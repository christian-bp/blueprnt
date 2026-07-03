# CRUD success toasts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every user-initiated create/update/delete confirms with a toast. Mount the toaster, add the convention + i18n, then wire `toast.success` (and `toast.error` where there's no other error surface) across ~30 CRUD sites.

**Architecture:** sonner (already installed in `@workspace/ui`) via the shared `Toaster`, mounted once in `providers.tsx`. Call sites use `toast` from `sonner` directly with a `dashboard.toast.*` i18n message. No backend, no wrappers.

**Tech Stack:** Next.js 16 client components, sonner 2.0.7 (`@workspace/ui/components/sonner`), next-intl, Convex `useMutation`, Vitest 4 + @testing-library/react.

## Global Constraints

- All user-facing text via i18n (en source, mirrored sv/nb/da/fi; nb/da/fi machine drafts flagged for native review). No em dashes.
- Do NOT modify shadcn vendor files (`packages/ui/src/*`). Keep existing inline error UI (`FormMessage`, `setFailure`) as-is.
- Tests: Vitest 4 (`bunx vitest run` from `apps/dashboard`); pre-commit runs Biome + full typecheck + full tests, must pass without `--no-verify`. Work on `main`; do NOT push.
- Toast copy lives under `dashboard.toast.*`, per-operation. Excluded from toasts (do NOT add): onboarding-wizard steps, AI-generation requests (draft/prefill/weight-review/starter-import), per-criterion `setRating`, `rejectSuggestion`, and `deleteMyAccount`.

## The toast pattern (used by every wiring task)

At each site, in the success path after the mutation resolves:
```tsx
import { toast } from "sonner"
// inside the component:
const tToast = useTranslations("dashboard.toast")
// in the handler, after `await someMutation(...)` succeeds:
toast.success(tToast("<key>"))
```
If the site has NO existing visible error affordance (no `setFailure`/inline `FormMessage` for the failure), also add to its `catch`:
```tsx
toast.error(tToast("error"))
```
Never remove existing inline error handling. `toast()` is safe to call in tests without a mounted Toaster (it no-ops), so existing tests keep passing; a test that ASSERTS a toast mocks `sonner`.

---

### Task 1: Foundation (mount Toaster, declare dep, convention)

**Files:**
- Modify: `apps/dashboard/components/providers.tsx`
- Modify: `apps/dashboard/package.json` (+ `bun.lock` via install)
- Modify: `CLAUDE.md`
- Test: `apps/dashboard/components/providers.test.tsx` (create)

**Interfaces:**
- Produces: an app-wide mounted `<Toaster>`, and `sonner` as a declared dashboard dependency so `import { toast } from "sonner"` resolves explicitly.

- [ ] **Step 1: Declare the dependency**

In `apps/dashboard/package.json`, add to `dependencies` (keep alphabetical): `"sonner": "^2.0.7"` (match `packages/ui`). Then run `bun install` (updates `bun.lock`).

- [ ] **Step 2: Mount the Toaster** in `providers.tsx`

```tsx
"use client"

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import { ConvexReactClient } from "convex/react"
import { Toaster } from "@workspace/ui/components/sonner"
import { MotionConfig } from "motion/react"
import type { ReactNode } from "react"
import { authClient } from "@/lib/auth-client"

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL ?? "")

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
      {/* Honour the OS-level prefers-reduced-motion preference for all motion
          components in this app. */}
      <MotionConfig reducedMotion="user">{props.children}</MotionConfig>
      {/* App-wide toast host: CRUD success/error notifications render here. */}
      <Toaster />
    </ConvexBetterAuthProvider>
  )
}
```

- [ ] **Step 3: Write the mount test** `apps/dashboard/components/providers.test.tsx`

```tsx
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// The Convex/auth provider needs no real client for this mount check.
vi.mock("@convex-dev/better-auth/react", () => ({
  ConvexBetterAuthProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock("convex/react", () => ({ ConvexReactClient: class {} }))
vi.mock("@/lib/auth-client", () => ({ authClient: {} }))

import { Providers } from "@/components/providers"

describe("Providers", () => {
  afterEach(() => {
    document.body.innerHTML = ""
  })

  it("mounts the toaster so CRUD toasts have a host", () => {
    render(
      <Providers initialToken={null}>
        <div>child</div>
      </Providers>
    )
    // Sonner renders a region with aria-label containing "Notifications".
    expect(document.querySelector("[data-sonner-toaster]")).not.toBeNull()
  })
})
```

Run: `cd apps/dashboard && bunx vitest run components/providers.test.tsx` — Expected: PASS. (If sonner's DOM hook differs, assert on `section[aria-label]` from the Toaster; the intent is "a Toaster is in the tree".)

- [ ] **Step 4: Add the CLAUDE.md convention** (under Conventions, after the skeleton/loading bullet)

```markdown
- **User-initiated CRUD shows a toast.** Every create / update / save / delete / remove / archive / approve a user triggers confirms completion with `toast.success(t("dashboard.toast.<op>"))` (sonner, via the app-wide `<Toaster>` mounted in `providers.tsx`), so nothing completes silently. On failure show `toast.error(t("dashboard.toast.error"))` where the surface has no other error affordance; keep inline `FormMessage` field validation for form errors. Toast copy lives in `dashboard.toast.*`, per-operation and localized in every locale. Not everything toasts: multi-step wizard/onboarding steps (navigation is the feedback), AI generation requests (their panel shows the result), and continuous/auto-saves such as per-criterion rating (a toast per step is noise). A new CRUD surface wires its toast in the same change.
```

- [ ] **Step 5: Verify + commit**

Run: `bunx biome check --write apps/dashboard/components/providers.tsx apps/dashboard/components/providers.test.tsx`; `bunx turbo typecheck --filter=dashboard`.
```bash
git add apps/dashboard/components/providers.tsx apps/dashboard/components/providers.test.tsx apps/dashboard/package.json bun.lock CLAUDE.md
git commit -m "feat(overview): mount the toaster and add the CRUD-toast convention"
```

---

### Task 2: Toast i18n (`dashboard.toast.*`, all locales)

**Files:**
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json`
- Modify: `docs/go-live-checklist.md`

**Interfaces:**
- Produces the keys the wiring tasks read: `dashboard.toast.{error, roleCreated, roleUpdated, roleArchived, anchorSet, anchorUpdated, familyCreated, familyRenamed, familyDeleted, criterionAdded, criterionUpdated, criterionRemoved, weightsSaved, complianceSaved, criterionApproved, criterionReopened, orgSaved, logoUpdated, logoRemoved, memberRoleUpdated, memberRemoved, invitationRevoked, avatarUpdated, avatarRemoved, languageUpdated, twoFactorEnabled, twoFactorReset, userCreated, userDeleted, organizationCreated, membershipAdded, membershipUpdated, membershipRemoved}`.

- [ ] **Step 1: Add the `toast` block to `en.json`** (as a new key under `dashboard`, e.g. after `dashboard.validation`)

```json
"toast": {
  "error": "Something went wrong. Try again.",
  "roleCreated": "Role created",
  "roleUpdated": "Role updated",
  "roleArchived": "Role archived",
  "anchorSet": "Anchor role set",
  "anchorUpdated": "Anchor role updated",
  "familyCreated": "Family created",
  "familyRenamed": "Family renamed",
  "familyDeleted": "Family deleted",
  "criterionAdded": "Criterion added",
  "criterionUpdated": "Criterion updated",
  "criterionRemoved": "Criterion removed",
  "weightsSaved": "Weighting saved",
  "complianceSaved": "Documentation saved",
  "criterionApproved": "Criterion approved",
  "criterionReopened": "Criterion reopened",
  "orgSaved": "Organization settings saved",
  "logoUpdated": "Logo updated",
  "logoRemoved": "Logo removed",
  "memberRoleUpdated": "Member role updated",
  "memberRemoved": "Member removed",
  "invitationRevoked": "Invitation revoked",
  "avatarUpdated": "Profile picture updated",
  "avatarRemoved": "Profile picture removed",
  "languageUpdated": "Language updated",
  "twoFactorEnabled": "Two-factor authentication enabled",
  "twoFactorReset": "Two-factor settings updated",
  "userCreated": "User created",
  "userDeleted": "User deleted",
  "organizationCreated": "Organization created",
  "membershipAdded": "Added to organization",
  "membershipUpdated": "Membership updated",
  "membershipRemoved": "Removed from organization"
}
```

- [ ] **Step 2: Mirror the SAME keys to sv/nb/da/fi** with translated values. Author sv (authoritative); nb/da/fi are machine drafts. Write with Edit/Write as UTF-8 (never shell sed/perl). Suggested Swedish (sv) values:

`error` "Något gick fel. Försök igen." · `roleCreated` "Roll skapad" · `roleUpdated` "Roll uppdaterad" · `roleArchived` "Roll arkiverad" · `anchorSet` "Ankarroll angiven" · `anchorUpdated` "Ankarroll uppdaterad" · `familyCreated` "Familj skapad" · `familyRenamed` "Familj omdöpt" · `familyDeleted` "Familj borttagen" · `criterionAdded` "Kriterium tillagt" · `criterionUpdated` "Kriterium uppdaterat" · `criterionRemoved` "Kriterium borttaget" · `weightsSaved` "Viktning sparad" · `complianceSaved` "Dokumentation sparad" · `criterionApproved` "Kriterium godkänt" · `criterionReopened` "Kriterium återöppnat" · `orgSaved` "Organisationsinställningar sparade" · `logoUpdated` "Logotyp uppdaterad" · `logoRemoved` "Logotyp borttagen" · `memberRoleUpdated` "Medlemsroll uppdaterad" · `memberRemoved` "Medlem borttagen" · `invitationRevoked` "Inbjudan återkallad" · `avatarUpdated` "Profilbild uppdaterad" · `avatarRemoved` "Profilbild borttagen" · `languageUpdated` "Språk uppdaterat" · `twoFactorEnabled` "Tvåfaktorsautentisering aktiverad" · `twoFactorReset` "Tvåfaktorsinställningar uppdaterade" · `userCreated` "Användare skapad" · `userDeleted` "Användare borttagen" · `organizationCreated` "Organisation skapad" · `membershipAdded` "Tillagd i organisationen" · `membershipUpdated` "Medlemskap uppdaterat" · `membershipRemoved` "Borttagen från organisationen".

For nb/da/fi, translate each into natural Bokmål/Danish/Finnish (short confirmations), matching each locale's existing terminology for role/criterion/family/member (see `dashboard.roles.evaluated`, `model.*`). Flag them for native review (Step 3).

- [ ] **Step 3: Go-live flag** — add under "Content and localization" in `docs/go-live-checklist.md`:

```markdown
- [ ] **Native review of the CRUD toast strings.** `dashboard.toast.*` (sv/nb/da/fi) were machine-drafted from English (sv authored in-house). Have a native speaker review before launch.
```

- [ ] **Step 4: Verify + commit**

Run: `bunx biome check --write packages/i18n/messages/*.json`; `cd packages/i18n && bunx vitest run` (parity PASS); `bunx turbo typecheck --filter=dashboard`.
```bash
git add packages/i18n/messages docs/go-live-checklist.md
git commit -m "feat(i18n): add CRUD toast strings"
```

---

### Tasks 3-9: Wire toasts per surface

Each task: apply the toast pattern (above) to every listed site, and add ONE representative test that mocks `sonner` and asserts `toast.success` fires after the resolved mutation. Import `{ toast } from "sonner"` and `const tToast = useTranslations("dashboard.toast")` in each file. Commit per task with `feat(overview): toast on <surface> changes`.

**Worked example (applies to every site) — Task 3's `create-role-dialog.tsx`:**
Its `onSubmit` currently is `try { const { slug } = await createRole({...}); setOpen(false); router.push(...) } catch { setFailure(...) }`. Add the toast on success (it already has inline error via `setFailure`, so no error toast):
```tsx
const { slug } = await createRole({ ... })
toast.success(tToast("roleCreated"))
setOpen(false)
router.push(`/roles/${slug}`)
```
Representative test: mock `vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))`, render the dialog with a mocked `createRole` that resolves, submit a valid form, and assert `toast.success` was called. (If a site has no existing test file, add a minimal one for the primary site of the surface.)

- [ ] **Task 3 — Roles.** `create-role-dialog.tsx` → `roleCreated`; `role-profile-card.tsx` save → `roleUpdated`, archive → `roleArchived`; `role-anchor-control.tsx` designate → `anchorSet`, update → `anchorUpdated`. Sites with no inline error surface get `toast.error(tToast("error"))` in catch. Representative test: create-role success toast. Commit.

- [ ] **Task 4 — Families.** `family-picker.tsx` create → `familyCreated`; `rename-family-dialog.tsx` → `familyRenamed`; `family-actions-menu.tsx` remove → `familyDeleted` (destructive AlertDialog; add `toast.error` in catch if none). Representative test: family delete success toast. Commit.

- [ ] **Task 5 — Criteria & weights.** `add-criterion-dialog.tsx` → `criterionAdded`; `edit-criterion-dialog.tsx` → `criterionUpdated`; `model-builder.tsx` remove → `criterionRemoved`, `rebalanceWeights` save → `weightsSaved`. Representative test: add-criterion success toast. Commit.

- [ ] **Task 6 — Compliance.** `criterion-compliance-dialog.tsx` save → `complianceSaved`, approve → `criterionApproved`, reopen → `criterionReopened`. (Do NOT toast the AI draft action.) Representative test: approve success toast. Commit.

- [ ] **Task 7 — Organization.** `organization-profile-form.tsx` name + settings → `orgSaved` (REPLACE the current inline "saved" message with the toast); `organization-logo-section.tsx` set → `logoUpdated`, remove → `logoRemoved`; `organization-members-section.tsx` role → `memberRoleUpdated`, remove → `memberRemoved`, `cancelInvitation` → `invitationRevoked`. Add `toast.error` in catch where a site lacks an error surface. Representative test: org settings save success toast. Commit.

- [ ] **Task 8 — Account.** `avatar-section.tsx` set → `avatarUpdated`, remove → `avatarRemoved`; `language-section.tsx` + `language-menu.tsx` → `languageUpdated`; `two-factor-section.tsx` clearMfa → `twoFactorReset`; `two-factor-setup.tsx` confirm → `twoFactorEnabled`. (Do NOT toast delete-account.) Representative test: avatar update success toast. Commit.

- [ ] **Task 9 — Admin.** `create-user-dialog.tsx` → `userCreated`; `delete-user-dialog.tsx` → `userDeleted`; `create-organization-dialog.tsx` → `organizationCreated`; `manage-organization-dialog.tsx` + `manage-user-organizations-dialog.tsx`: setMembershipRole → `membershipUpdated`, removeMembership → `membershipRemoved`, addMembership → `membershipAdded`, updateOrganization → `orgSaved`. Add `toast.error` in catch where no error surface. Representative test: create-user success toast. Commit.

Each task runs, before committing: `cd apps/dashboard && bunx vitest run <the surface's touched test files>` and relies on the pre-commit hook for the full suite + typecheck + Biome.

## Self-review notes (author)

- **Spec coverage:** foundation/mount (T1), convention (T1), dep (T1), i18n all locales + go-live (T2), all ~30 CRUD sites mapped across T3-T9, exclusions honored (not wired). Covered.
- **Key consistency:** the message keys in T2 exactly match the keys referenced in T3-T9 and the spec's map. `tToast = useTranslations("dashboard.toast")`; `toast` from `sonner`.
- **Open confirmations for implementers:** the exact success-path line per site (each implementer reads its file; the worked example shows the shape); whether a given site already has an inline error surface (keep it; only add `toast.error` where there is none); sonner's test DOM hook for the mount test (`[data-sonner-toaster]` or the labelled region).
