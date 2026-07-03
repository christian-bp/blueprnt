# CRUD success toasts across the dashboard

**Goal:** Every user-initiated create/update/delete confirms completion with a toast, so actions never complete silently (today, adding a criterion gives no feedback). Establish the toast system (mount it, add a convention), then wire success toasts across the CRUD surface.

**Context (audit):** `sonner` 2.0.7 and a themed shadcn `Toaster` (`@workspace/ui/components/sonner`) are installed, but the `Toaster` is **never mounted** and there are **zero** `toast()` calls anywhere. Of 54 mutation call sites, only the org-profile form gives any feedback (an inline "saved"). So this is greenfield: mount once, add the convention + i18n, and wire ~30 CRUD sites.

## Global constraints

- Audience is HR/comp professionals. All user-facing text via i18n (en source, mirrored sv/nb/da/fi; nb/da/fi machine drafts flagged for native review). No em dashes. Terminology: Evaluate/Evaluated; a role has a profile.
- shadcn vendor files (`packages/ui/src/*`, incl. `sonner.tsx`) are NOT modified.
- Internal navigation uses `Link`; forms use react-hook-form + Zod + `FormMessage` for field errors.

## Foundation

1. **Mount the Toaster once.** In `apps/dashboard/components/providers.tsx`, render `<Toaster />` (from `@workspace/ui/components/sonner`) inside `ConvexBetterAuthProvider`, as a sibling of the `MotionConfig`. It works without a `next-themes` provider (its `useTheme()` falls back to `"system"`). App-wide, so toasts show on every screen including onboarding/auth.
2. **Declare the dependency.** Add `"sonner": "^2.0.7"` to `apps/dashboard/package.json` (matching `packages/ui`) and run `bun install`, so `import { toast } from "sonner"` resolves explicitly rather than via workspace hoisting. Call sites import `{ toast } from "sonner"`.
3. **i18n namespace.** New `dashboard.toast.*`, per-operation full sentences (not composed from "{item} + created" — Nordic word order/inflection differs, e.g. "Rollen skapades"), in all five locales.
4. **CLAUDE.md convention** (add under Conventions):
   > **User-initiated CRUD shows a toast.** Every create / update / save / delete / remove / archive / approve a user triggers confirms completion with `toast.success(t("dashboard.toast.<op>"))` (sonner, via the app-wide `<Toaster>` in `providers.tsx`) so nothing completes silently. On failure, show `toast.error(t("dashboard.toast.error"))` where the surface has no other error affordance; keep inline `FormMessage` field validation for form errors. Toast copy lives in `dashboard.toast.*`, per-operation and localized in every locale. Not everything toasts: multi-step wizard/onboarding steps (the flow's own navigation is the feedback), AI generation requests (their panel shows the result), and continuous/auto-saves such as per-criterion rating are excluded (a toast per step/keystroke is noise). A new CRUD surface wires its toast in the same change.

## Toast pattern (per site)

In the success path, after the mutation resolves:
```ts
await createRole({ ... })
toast.success(t("dashboard.toast.roleCreated"))
```
Where a site has no existing visible error affordance, add to its `catch`:
```ts
toast.error(t("dashboard.toast.error"))
```
Keep existing inline error UI (`setFailure`, `FormMessage`) as-is — do not remove it.

## Messages (`dashboard.toast.*`, en source; reused across sites where identical)

`error`: "Something went wrong. Try again." — generic failure.
Roles: `roleCreated` "Role created" · `roleUpdated` "Role updated" · `roleArchived` "Role archived" · `anchorSet` "Anchor role set" · `anchorUpdated` "Anchor role updated".
Families: `familyCreated` "Family created" · `familyRenamed` "Family renamed" · `familyDeleted` "Family deleted".
Criteria: `criterionAdded` "Criterion added" · `criterionUpdated` "Criterion updated" · `criterionRemoved` "Criterion removed" · `weightsSaved` "Weighting saved".
Compliance: `complianceSaved` "Documentation saved" · `criterionApproved` "Criterion approved" · `criterionReopened` "Criterion reopened".
Organization: `orgSaved` "Organization settings saved" (name + settings) · `logoUpdated` "Logo updated" · `logoRemoved` "Logo removed" · `memberRoleUpdated` "Member role updated" · `memberRemoved` "Member removed" · `invitationRevoked` "Invitation revoked".
Account: `avatarUpdated` "Profile picture updated" · `avatarRemoved` "Profile picture removed" · `languageUpdated` "Language updated" · `twoFactorEnabled` "Two-factor authentication enabled" · `twoFactorReset` "Two-factor settings updated".
Admin: `userCreated` "User created" · `userDeleted` "User deleted" · `organizationCreated` "Organization created" · `membershipAdded` "Added to organization" · `membershipUpdated` "Membership updated" · `membershipRemoved` "Removed from organization".

## Site → message map (the wiring list)

- **Roles:** create-role-dialog → `roleCreated`; role-profile-card save → `roleUpdated`, archive → `roleArchived`; role-anchor-control designate → `anchorSet`, update → `anchorUpdated`.
- **Families:** family-picker create → `familyCreated`; rename-family-dialog → `familyRenamed`; family-actions-menu remove → `familyDeleted`.
- **Criteria:** add-criterion-dialog → `criterionAdded`; edit-criterion-dialog → `criterionUpdated`; model-builder remove → `criterionRemoved`, rebalanceWeights save → `weightsSaved`.
- **Compliance:** criterion-compliance-dialog save → `complianceSaved`, approve → `criterionApproved`, reopen → `criterionReopened`.
- **Organization:** organization-profile-form name + settings → `orgSaved` (replace the current inline "saved" message with the toast); organization-logo-section set → `logoUpdated`, remove → `logoRemoved`; organization-members-section role → `memberRoleUpdated`, remove → `memberRemoved`, cancelInvitation → `invitationRevoked`.
- **Account:** avatar-section set → `avatarUpdated`, remove → `avatarRemoved`; language-section + language-menu → `languageUpdated`; two-factor-section clearMfa → `twoFactorReset`; two-factor-setup confirm → `twoFactorEnabled`.
- **Admin:** create-user → `userCreated`; delete-user → `userDeleted`; create-organization → `organizationCreated`; manage-organization + manage-user-organizations setMembershipRole → `membershipUpdated`, removeMembership → `membershipRemoved`, addMembership → `membershipAdded`, updateOrganization → `orgSaved`.

## Excluded (with rationale)

- **Onboarding wizard steps** (`completeOnboarding`, country/industry screens, `createModelFromTemplate`/ensure-default-model, the families draft flow `createStarterSet`/`reconcileStarterSet`) — a guided flow; navigation between steps is the feedback, a toast per step is noise.
- **AI generation requests** (`draftCriterionCompliance`, `requestWeightReview`/`confirmWeightReview`, `requestStarterImport`/`confirmStarterImport`, `prefillRoleProfiles`) — their own panels show the result; not CRUD confirmations.
- **Per-criterion rating** (`setRating`) — saved continuously while rating; a toast on each is noise.
- **Suggestion dismiss** (`rejectSuggestion`) — minor, not a CRUD confirmation.
- **Delete account** (`deleteMyAccount`) — signs the user out and redirects; a toast on an unmounting page would not be seen. The redirect is the feedback.

## Testing

- **Mount:** a smoke test asserting `providers.tsx` renders the `Toaster` (or that `<Toaster>` is present), so it can never regress to unmounted.
- **Representative success toasts:** for each surface, extend the primary create/delete site's existing component test to mock `sonner` (`vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))`) and assert `toast.success` fires after the resolved mutation (e.g. create-role, add-criterion, family delete, compliance approve). We do NOT add a bespoke toast test to all ~30 sites (disproportionate for a one-line side effect); the convention plus per-surface review cover the rest. Existing tests that render a wired component must mock `sonner` so the `toast` import does not error.
- i18n parity test guards the new keys across locales.

## File structure & tasks (for the plan)

- Foundation: `providers.tsx` (mount), `apps/dashboard/package.json` + lockfile (dep), `packages/i18n/messages/*.json` (the `dashboard.toast.*` block, all locales), `docs/go-live-checklist.md` (native-review flag), `CLAUDE.md` (convention).
- Then one task per surface (roles, families, criteria/weights, compliance, organization, account, admin), each wiring `toast.success`/`toast.error` per the map and adding the representative test for that surface.

## Non-goals

- No toast queue/dedup config changes (sonner defaults). No changes to `sonner.tsx` (vendor). No error-toast retrofit for non-CRUD flows. No backend changes.
