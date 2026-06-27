# Account Settings Polish + Avatar Upload Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** (1) Move the account-settings tabs into the top app header (matching the model/admin section pattern); (2) restructure each account section into a shadcn `Card` (polyform-style: title + description + content + footer action), stacked in a narrow column; (3) add avatar upload backed by Convex file storage, shown in the nav, and erased with the user.

**Architecture:** The header (`site-header.tsx`) already renders per-section tabs by branching on the first path segment; add an `account` branch for the existing `AccountTabs`. Sections become `Card`s composed onto the two pages. Avatar files live in Convex `_storage`; the `_storage` id is kept on the `users` mirror (PII, erased with the row + file), and the served URL is written to Better Auth `user.image` for nav/session display.

**Tech Stack:** Convex (file storage) + Better Auth 1.6.17, Next 16, React 19, next-intl, Tailwind v4 + shadcn (`Card`, `Avatar`), motion/react, Vitest 4 + convex-test.

**Builds on:** the account-settings feature (commits e3d8625..bb82040). Spec: `docs/superpowers/specs/2026-06-27-account-settings-design.md`.

## Global Constraints
- No em dashes anywhere (UI copy, comments, commits). All user-facing text via next-intl i18n in ALL FIVE locales (en first, mirror to sv/nb/da/fi; non-ASCII via the Edit/Write tool, never shell sed/perl); parity test must stay green; new Nordic strings are drafts (flag in `docs/go-live-checklist.md`).
- Forms keep the project pattern (RHF + `makeXSchema(t)` + shadcn `Form` + `SubmitButton`; pre-filled edit forms gate on `!isValid || !isDirty`; errors below the action). Per-user account changes write NO org audit rows.
- **PII / erasure invariant (CLAUDE.md):** the avatar is personal data. Its `_storage` id lives only on the `users` mirror. A person is erasable via a true hard delete: BOTH erase paths (`accounts/account.ts` `eraseSelf` and `platform/admin.ts` `deleteUser`) MUST delete the stored avatar file before deleting the mirror row, so no avatar PII survives erasure.
- New code ships with tests in the same commit. `bun run test` only (never `bun test`). Pre-commit hook (Biome + typecheck + full `turbo run test`) must pass; never `--no-verify`. Internal nav via `Link`. Commit per task on `main` (no branch/worktree). Reduced motion respected; read `docs/ui-animation.md` before any animation.
- Reuse: shadcn `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`/`CardFooter`, `Avatar`/`AvatarImage`/`AvatarFallback`, `SubmitButton`, `Spinner`, `CopyButton`, `PasswordInput`, existing schema factories.

---

### Task 1: Move account tabs into the top header

**Files:**
- Modify: `apps/dashboard/components/site-header.tsx`
- Modify: `apps/dashboard/app/(app)/account/layout.tsx`
- Test: `apps/dashboard/components/account/account-tabs.test.tsx` stays green; if `site-header` has a test, add an `/account` case.
- Reference: `site-header.tsx` already does `const [section] = pathname.split("/").filter(Boolean)` and branches `inWorkSection`/`inAdminSection`/`inModelSection` to render `<SectionTabs/>`/`<AdminTabs/>`/`<ModelTabs/>`. `AccountTabs` already exists and is header-ready (unique `layoutId="account-tab-underline"`).

- [ ] **Step 1:** In `site-header.tsx`, add `const inAccountSection = section === "account"` and a branch rendering `<AccountTabs />` (import it from `@/components/account/account-tabs`), alongside the existing section branches.
- [ ] **Step 2:** In `app/(app)/account/layout.tsx`, remove the `<AccountTabs />` render, its import, and the title/`space-y-1` block. Replace the body with a narrow settings column that holds `{children}`, e.g. `<div className="mx-auto w-full max-w-2xl">{props.children}</div>` (the per-page content already provides `space-y-6`). Keep it `"use client"` only if it still needs `useTranslations`; if nothing else uses translations there, it can be a plain server layout returning the wrapper.
- [ ] **Step 3:** Verify: on `/account/profile` and `/account/security` the header shows the Profile/Security tabs with the active one underlined, and the page content no longer shows an in-content tab bar. Run `bun run --filter dashboard test -- account-tabs site-header` and typecheck.
- [ ] **Step 4:** Commit: `feat(account): move account tabs into the top header`

---

### Task 2: Avatar storage backend + erasure cleanup

**Files:**
- Modify: `packages/backend/convex/accounts/tables.ts` (add `imageId` to `users`)
- Modify: `packages/backend/convex/accounts/account.ts` (3 new functions + erasure cleanup)
- Modify: `packages/backend/convex/platform/admin.ts` (`deleteUser`: delete avatar file)
- Test: `packages/backend/convex/accounts/account.test.ts` (extend)
- Reference: polyform `packages/backend/convex/storage.ts` (`generateUploadUrl`), `convex/users.ts` (`updateUserImage`/`removeUserImage` delete the old `_storage` file first), and this repo's existing `eraseSelf` + `platform/admin.ts deleteUser`.

**Interfaces — Produces:**
- `users` mirror gains `imageId: v.optional(v.id("_storage"))` (the uploaded avatar's storage id; erased with the row + the file).
- `api.accounts.account.generateAvatarUploadUrl` (authedMutation, args `{}`) -> `string` (a one-shot upload URL via `ctx.storage.generateUploadUrl()`).
- `api.accounts.account.setMyAvatar` (authedMutation, args `{ storageId: v.id("_storage") }`) -> `string` (the served URL): reads the mirror; if it already has an `imageId`, `await ctx.storage.delete(oldId)`; patches `imageId = storageId`; returns `await ctx.storage.getUrl(storageId)` (throw `appError(ERROR_CODES.notFound)` if null). The client then calls `authClient.updateUser({ image: url })`.
- `api.accounts.account.removeMyAvatar` (authedMutation, args `{}`) -> `null`: if the mirror has an `imageId`, delete the file and clear `imageId`. The client then calls `authClient.updateUser({ image: "" })`.

**Erasure cleanup (the invariant):**
- In `eraseSelf` (account.ts): BEFORE deleting the mirror row, if `mirror.imageId != null`, `await ctx.storage.delete(mirror.imageId)`.
- In `platform/admin.ts deleteUser`: same — after fetching the mirror and before `ctx.db.delete(mirror._id)`, if `mirror.imageId != null`, `await ctx.storage.delete(mirror.imageId)`.

- [ ] **Step 1:** Write failing tests (convex-test supports `ctx.storage`): `setMyAvatar` stores the id and returns a url; calling it again deletes the previous file (assert the old id's url is now null) and stores the new; `removeMyAvatar` deletes the file and clears `imageId`; `eraseSelf` with an avatar deletes the stored file (old id url null) as part of erasure. Add a focused test that the platform `deleteUser` path also deletes the avatar file.
- [ ] **Step 2:** Run `bun run --filter @workspace/backend test -- account` and `-- admin` -> FAIL.
- [ ] **Step 3:** Add the `imageId` field, implement the three functions, and add the storage-delete step to both erase paths.
- [ ] **Step 4:** Run the backend suite -> PASS.
- [ ] **Step 5:** Commit: `feat(accounts): store avatar in file storage and erase it with the user`

---

### Task 3: AvatarUpload component, avatar section, nav rendering

**Files:**
- Create: `apps/dashboard/components/account/avatar-upload.tsx` (+ `.test.tsx`)
- Create: `apps/dashboard/components/account/avatar-section.tsx` (the Card wrapper; or fold into the profile page in Task 4 — keep the upload control its own component regardless)
- Modify: `apps/dashboard/components/nav-user.tsx` and `apps/dashboard/components/account-menu.tsx` (render `<AvatarImage>` from the session image)
- Modify: i18n (`dashboard.account.profile.avatar.*`)
- Reference: polyform `components/avatar-upload.tsx` (clickable avatar, hidden `accept="image/*"` input, `URL.createObjectURL` preview, spinner, remove button) and `hooks/use-upload.ts` (generateUploadUrl -> `fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file })` -> `{ storageId }`). Adapt Clerk -> Better Auth.

**Behavior:**
- Clickable `Avatar` (e.g. `size-20`) showing `session.user.image` (or a preview) with an initials/icon `AvatarFallback`; a hidden file input (`accept="image/*"`, single file); a small remove (X) button shown only when an image exists.
- Client validation BEFORE upload: reject files over a max size (use `5 * 1024 * 1024`) or non-image mime types with an inline error (`avatar.tooLarge` / `avatar.invalidType`).
- Upload flow: `const url = await generateAvatarUploadUrl()`; `const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file })`; `const { storageId } = await res.json()`; `const served = await setMyAvatar({ storageId })`; `await authClient.updateUser({ image: served })`. Show a `URL.createObjectURL(file)` preview while uploading; a `Spinner` over the avatar during the request.
- Remove flow: `await removeMyAvatar(); await authClient.updateUser({ image: "" })`.
- `nav-user.tsx` + `account-menu.tsx`: add `{session?.user?.image && <AvatarImage src={session.user.image} alt={name} />}` above the existing `AvatarFallback` (keep initials as fallback). Key the `Avatar` on the image so it re-renders on change.
- i18n: `dashboard.account.profile.avatar.{title,description,helper,remove,tooLarge,invalidType}` in all 5 locales.

- [ ] **Step 1:** Write failing tests: a valid image select runs generateAvatarUploadUrl -> fetch -> setMyAvatar({storageId}) -> `updateUser({ image })`; an oversized/wrong-type file shows the error and uploads nothing; the remove button calls `removeMyAvatar` + `updateUser({ image: "" })`. Mock `convex/react` (`useMutation`), `@/lib/auth-client` (`useSession` returns `{ data: { user: { image, name, email } } }`, `updateUser`), and `global.fetch`.
- [ ] **Step 2:** Run `bun run --filter dashboard test -- avatar` -> FAIL.
- [ ] **Step 3:** Implement the component, the avatar section Card, the nav `AvatarImage` additions, and i18n.
- [ ] **Step 4:** Run the dashboard suite + i18n parity -> PASS.
- [ ] **Step 5:** Commit: `feat(account): add avatar upload with nav display`

---

### Task 4: Restructure Profile sections into Cards + compose the profile page

**Files:**
- Modify: `apps/dashboard/components/account/profile-name-form.tsx`, `change-email-form.tsx`, `language-section.tsx` (+ their tests)
- Modify: `apps/dashboard/app/(app)/account/profile/page.tsx`
- Modify: i18n (`*.description` keys)
- Reference: polyform `components/account/display-name.tsx` (the canonical Card anatomy: `<Card><CardHeader><CardTitle/><CardDescription/></CardHeader><CardContent>control</CardContent><CardFooter className="flex items-center justify-between">helper + SubmitButton</CardFooter></Card>`).

**Behavior:**
- Wrap each section's existing logic in the `Card` anatomy: `CardTitle` = the section name, `CardDescription` = a short explanation (new i18n key), `CardContent` = the field(s)/control, `CardFooter` = optional helper text (left) + the action button (right). Keep all existing form logic, validation, gating, error placement, and i18n labels; only the visual container changes. Inputs may use a readable `max-w` (e.g. `max-w-sm`) per polyform.
- `LanguageSection` (no submit button) becomes a Card with the select in the content and the label/help in the header.
- `profile/page.tsx`: compose, in a `space-y-6` stack, the Avatar card (from Task 3), then `<ProfileNameForm/>`, `<ChangeEmailForm/>`, `<LanguageSection/>`. Remove the page-level `<h2>` wrappers added previously (the `CardTitle` is now the heading; avoid double headings).
- Update each section test for the new structure (field labels stay the same; section headings are now `CardTitle` text). Add `*.description` (+ any helper) keys to all 5 locales.

- [ ] **Step 1:** Update/extend the three section tests for the Card structure (still asserting the same behavior + labels) -> run -> FAIL where structure changed.
- [ ] **Step 2:** Refactor the three components into the Card anatomy; add description i18n in 5 locales; compose `profile/page.tsx`.
- [ ] **Step 3:** Run `bun run --filter dashboard test` + i18n parity -> PASS.
- [ ] **Step 4:** Commit: `refactor(account): restructure profile sections as cards`

---

### Task 5: Restructure Security sections into Cards + compose the security page

**Files:**
- Modify: `apps/dashboard/components/account/change-password-form.tsx`, `two-factor-section.tsx`, `delete-account-section.tsx` (+ their tests)
- Modify: `apps/dashboard/app/(app)/account/security/page.tsx`
- Modify: i18n (`*.description` keys)
- Reference: polyform `display-name.tsx` (standard Card) and `delete-account.tsx` (destructive Card: `<Card className="border-destructive">` with the action in the footer).

**Behavior:**
- Wrap each into the Card anatomy as in Task 4. `ChangePasswordForm`: fields in content, Save in footer. `TwoFactorSection`: current method + controls in content (the backup-codes panel stays as-is inside), the change-method/regenerate actions sensibly placed (footer or content). `DeleteAccountSection`: a `border-destructive` Card; the last-admin note state and the type-to-confirm + password + destructive button keep their exact logic (do NOT regress the empty-email guard / last-admin guard / signOut flow); only the container becomes the Card.
- `security/page.tsx`: compose `<ChangePasswordForm/>`, `<TwoFactorSection/>`, `<DeleteAccountSection/>` in a `space-y-6` stack; remove the page-level `<h2>` wrappers (CardTitle is the heading).
- Update the three section tests for the new structure; keep all behavioral assertions (especially DeleteAccountSection's guard tests). Add `*.description` keys to all 5 locales.

- [ ] **Step 1:** Update/extend the three section tests for the Card structure -> run -> FAIL where structure changed.
- [ ] **Step 2:** Refactor the three components; add description i18n in 5 locales; compose `security/page.tsx`.
- [ ] **Step 3:** Run `bun run --filter dashboard test` + i18n parity -> PASS.
- [ ] **Step 4:** Commit: `refactor(account): restructure security sections as cards`

---

## Self-Review
- **Coverage:** tabs-to-header (T1), section Card restructure profile+security (T4, T5), avatar upload backend+storage+erasure (T2) and UI+nav (T3). All three user requests covered.
- **PII/erasure:** the avatar `_storage` id lives on the `users` mirror and is deleted (file + field) in BOTH erase paths (T2) — the hard-delete invariant holds.
- **No placeholders:** the avatar flow, the header edit, and the Card anatomy are concrete with cited reference files. Validation limits are explicit (5 MB, image mime types).
- **Type consistency:** `setMyAvatar({ storageId }) -> string`, `removeMyAvatar() -> null`, `generateAvatarUploadUrl() -> string` are produced in T2 and consumed by name in T3. `imageId` field name is consistent across the mirror, the mutations, and both erase paths.
