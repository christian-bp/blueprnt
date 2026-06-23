# Create-User: Welcome Email, Required Org, Named Sender — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Platform-admin user creation sends a welcome (set-password) email instead of a reset email, requires choosing an organization + role, and all transactional mail is sent from a named, replyable address.

**Architecture:** The `sendResetPassword` hook picks the email template by account state (no password yet → `welcome`, else → `resetPassword`). `createUser` provisions + adds the membership atomically. The sender `from` becomes `blueprnt <hello@blueprnt.se>` (Sweego parses the display name).

**Tech Stack:** Convex (Better Auth component), React Email, next-intl, shadcn `Select`, Vitest, the `@christian-ek/sweego` component.

## Global Constraints

- **Do NOT commit per task** (CLAUDE.md): leave everything uncommitted in the working tree for review; commit only after explicit approval. Each task ends at "tests pass."
- **No worktrees / feature branches**: work directly in the main checkout.
- **i18n English-first**, mirrored to sv/nb/da/fi (parity-guarded). New non-English strings are drafts for native review. **No em dashes.** Use the Edit tool for JSON (non-ASCII).
- **Welcome email is org-agnostic** (no `{organizationName}`): body is "An account was created for you on blueprnt. Set your password below to get started."
- **Brand color `#eb3e5d`** is unchanged; the welcome template reuses the reset template's structure (no name emphasis needed; no placeholders).
- **`createUser` requires an org**: an orgless user must never be created; the membership is added in the same mutation.
- **Sender** `from` = `blueprnt <hello@blueprnt.se>` (display name + replyable address).
- New Convex functions require `bunx convex codegen` (from `packages/backend`, using the local `.env.local`) so `_generated` includes them; commit the regenerated files with the rest.
- The eventual commit's pre-commit hook (Biome + full `turbo typecheck` + full `turbo test`) must pass; never `--no-verify`.

## File Structure

- `packages/backend/convex/email/outbox.ts` — sender default.
- `packages/constants/src/email.ts` — add `welcome` key.
- `packages/email/src/templates/welcome.tsx` (new) + `render.ts` + `render.test.ts`.
- `packages/i18n/messages/{en,sv,nb,da,fi}.json` — `email.welcome.*`, `dashboard.admin.emailLog.templates.welcome`, `dashboard.admin.users.create.{orgLabel,roleLabel}`.
- `packages/backend/convex/betterAuth/provisioning.ts` — `hasPassword` query.
- `packages/backend/convex/accounts/organization.ts` — `userHasPassword` internal query (+ its test).
- `packages/backend/convex/auth.ts` — `sendResetPassword` branch.
- `packages/backend/convex/platform/admin.ts` — `createUser` requires org + role (+ test).
- `apps/dashboard/lib/admin-schemas.ts` — `createUserSchema`.
- `apps/dashboard/components/admin/create-user-dialog.tsx` (+ its test).

---

### Task 1: Named, replyable sender

**Files:** Modify `packages/backend/convex/email/outbox.ts:10`. Plus a deployment env change.

- [ ] **Step 1:** Change the default:

```ts
// Domain configured at Sweego; the founder sets EMAIL_FROM. The default keeps
// the sender working once the domain is verified without a code change. The
// "Name <addr>" form is parsed by the Sweego client into a display name +
// address, and hello@ is a replyable mailbox (not no-reply).
const FROM_EMAIL = process.env.EMAIL_FROM ?? "blueprnt <hello@blueprnt.se>"
```

- [ ] **Step 2:** Update the deployment env (the env overrides the default; controller-run after approval): `bunx convex env set EMAIL_FROM "blueprnt <hello@blueprnt.se>"` from `packages/backend`. Verify: `bunx convex env get EMAIL_FROM` prints `blueprnt <hello@blueprnt.se>`.

No test (env-driven sender). Typecheck only.

---

### Task 2: Welcome email template

**Files:** Modify `packages/constants/src/email.ts`; create `packages/email/src/templates/welcome.tsx`; modify `packages/email/src/render.ts`, `render.test.ts`; modify the 5 locale files.

**Interfaces:** Produces `EmailTemplateKey` gains `"welcome"`; `WelcomeEmail({ url, locale })`; `email.welcome.*` i18n. Task 3 enqueues `templateKey: "welcome"`.

- [ ] **Step 1:** `packages/constants/src/email.ts` — add the key:

```ts
export const EMAIL_TEMPLATE_KEYS = ["invitation", "resetPassword", "welcome"] as const
```

- [ ] **Step 2:** Add `email.welcome` to `en.json` (after `resetPassword`, inside `email`), then mirror to the other four. Use the Edit tool.

en:
```json
    "welcome": {
      "subject": "Welcome to blueprnt",
      "heading": "Welcome to blueprnt",
      "body": "An account was created for you on blueprnt. Set your password below to get started.",
      "cta": "Set your password",
      "note": "If you weren't expecting this, you can ignore this email."
    }
```
sv:
```json
    "welcome": {
      "subject": "Välkommen till blueprnt",
      "heading": "Välkommen till blueprnt",
      "body": "Ett konto har skapats åt dig på blueprnt. Välj ett lösenord nedan för att komma igång.",
      "cta": "Välj ditt lösenord",
      "note": "Om du inte väntade dig detta kan du ignorera det här mejlet."
    }
```
nb:
```json
    "welcome": {
      "subject": "Velkommen til blueprnt",
      "heading": "Velkommen til blueprnt",
      "body": "En konto er opprettet for deg på blueprnt. Velg et passord nedenfor for å komme i gang.",
      "cta": "Velg passordet ditt",
      "note": "Hvis du ikke ventet dette, kan du ignorere denne e-posten."
    }
```
da:
```json
    "welcome": {
      "subject": "Velkommen til blueprnt",
      "heading": "Velkommen til blueprnt",
      "body": "Der er oprettet en konto til dig på blueprnt. Vælg en adgangskode nedenfor for at komme i gang.",
      "cta": "Vælg din adgangskode",
      "note": "Hvis du ikke forventede dette, kan du ignorere denne e-mail."
    }
```
fi:
```json
    "welcome": {
      "subject": "Tervetuloa blueprntiin",
      "heading": "Tervetuloa blueprntiin",
      "body": "Sinulle on luotu tili blueprntissä. Valitse salasana alta päästäksesi alkuun.",
      "cta": "Valitse salasanasi",
      "note": "Jos et odottanut tätä, voit jättää tämän viestin huomiotta."
    }
```

- [ ] **Step 3:** Add the admin-log filter label `dashboard.admin.emailLog.templates.welcome` in all 5 locales (after `resetPassword`, before `all`): en `"welcome": "Welcome"`, sv `"Välkommen"`, nb `"Velkommen"`, da `"Velkommen"`, fi `"Tervetuloa"`.

- [ ] **Step 4:** Create `packages/email/src/templates/welcome.tsx` (mirrors `reset-password.tsx`):

```tsx
import { Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { CtaButton } from "../components/button"
import { colors } from "../components/theme"
import { emailMessages } from "../messages"

export interface WelcomeEmailProps {
  url: string
  locale: string
}

export function WelcomeEmail({ url, locale }: WelcomeEmailProps) {
  const m = emailMessages(locale).welcome
  return (
    <BaseEmailTemplate preview={m.subject} title={m.heading} locale={locale}>
      <Text
        className="text-[16px] leading-[26px] m-0"
        style={{ color: colors.text }}
      >
        {m.body}
      </Text>
      <CtaButton href={url}>{m.cta}</CtaButton>
      <Text
        className="text-[14px] leading-[22px] m-0"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

WelcomeEmail.PreviewProps = {
  url: "https://app.blueprnt.se/reset-password?token=preview",
  locale: "en",
} satisfies WelcomeEmailProps

export default WelcomeEmail
```

- [ ] **Step 5:** Modify `packages/email/src/render.ts`: import `WelcomeEmail`, add `welcome: LinkEmailProps` to `EmailProps`, and add a `welcome` case to the switch (and make `resetPassword` explicit so `default` stays exhaustive). The switch becomes:

```ts
    case "invitation": {
      const p = props as InvitationEmailProps
      const element = InvitationEmail(p)
      return {
        subject: fillTemplate(m.invitation.subject, {
          inviterName: p.inviterName,
          organizationName: p.organizationName,
        }),
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
    case "welcome": {
      const element = WelcomeEmail(props as LinkEmailProps)
      return {
        subject: m.welcome.subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
    default: {
      const element = ResetPasswordEmail(props as LinkEmailProps)
      return {
        subject: m.resetPassword.subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
```
Add the import: `import { WelcomeEmail } from "./templates/welcome"`.

- [ ] **Step 6:** Extend `render.test.ts`: add a render assertion for `welcome`:

```ts
  it("renders the welcome email with the set-password link", async () => {
    const result = await renderEmail("welcome", {
      url: "https://x.example/reset?token=t",
      locale: "en",
    })
    expect(result.subject).toBe("Welcome to blueprnt")
    expect(result.html).toContain("https://x.example/reset?token=t")
    expect(result.html).toContain("Set your password")
  })
```

- [ ] **Step 7:** Run `bun run --filter @workspace/i18n test` (parity) and `bun run --filter @workspace/email test` (render). Expected: PASS.

---

### Task 3: Pick welcome vs reset by account state

**Files:** Modify `packages/backend/convex/betterAuth/provisioning.ts`, `accounts/organization.ts` (+ `organization.test.ts`), `auth.ts`. Regenerate `_generated`.

**Interfaces:** Consumes Task 2's `welcome` template key. Produces `components.betterAuth.provisioning.hasPassword({userId}) -> boolean` and `internal.accounts.organization.userHasPassword({userId}) -> boolean`.

- [ ] **Step 1:** Add to `provisioning.ts` (after `provisionUser`):

```ts
// True iff the user has a credential account (i.e. has set a password). A
// provisioned user has no account row until resetPassword creates one; the app
// is email/password-only, so any account row means a password is set.
export const hasPassword = query({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const account = await ctx.db
      .query("account")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .first()
    return account !== null
  },
})
```

- [ ] **Step 2:** Add to `accounts/organization.ts` (after `getLanguageForUser`; `components` is already imported):

```ts
// Thin app-boundary wrapper so the auth hook can branch the reset/welcome email
// on whether the user has set a password yet.
export const userHasPassword = internalQuery({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) =>
    ctx.runQuery(components.betterAuth.provisioning.hasPassword, { userId }),
})
```

- [ ] **Step 3:** Add a convex-test to `organization.test.ts`:

```ts
describe("userHasPassword", () => {
  it("is false for a provisioned user with no account, true once an account exists", async () => {
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.provisioning.provisionUser,
      { email: "new@acme.se", name: "New User" }
    )
    expect(
      await t.query(internal.accounts.organization.userHasPassword, { userId })
    ).toBe(false)
    await t.run(async (ctx) => {
      await ctx.db.insert("account", {
        userId,
        accountId: userId,
        providerId: "credential",
        password: "hash",
        createdAt: 0,
        updatedAt: 0,
      })
    })
    expect(
      await t.query(internal.accounts.organization.userHasPassword, { userId })
    ).toBe(true)
  })
})
```
Note: the `account` insert runs against the Better Auth component's tables; if `t.run` cannot insert into the component schema in this test harness, fall back to asserting `hasPassword` directly via `components.betterAuth.provisioning.hasPassword` after a `seedMembership`-style helper, or document the branch as e2e and keep only the false case. Adjust the insert fields to the component's `account` schema if they differ (check `betterAuth/schema.ts` / `_generated`).

- [ ] **Step 4:** Modify `auth.ts` `sendResetPassword` to branch:

```ts
      sendResetPassword: async (data) => {
        const mctx = requireRunMutationCtx(ctx)
        const userId = data.user.id
        // A provisioned user with no password yet gets the welcome / set-password
        // email; a user who already has a password gets the reset email. Same
        // link, different framing.
        const settings = await mctx.runQuery(
          internal.accounts.organization.getLanguageForUser,
          { userId }
        )
        const hasPassword = await mctx.runQuery(
          internal.accounts.organization.userHasPassword,
          { userId }
        )
        await mctx.runMutation(internal.email.outbox.enqueueEmail, {
          to: data.user.email,
          templateKey: hasPassword ? "resetPassword" : "welcome",
          props: { url: data.url },
          locale: settings?.language ?? "en",
        })
      },
```

- [ ] **Step 5:** Regenerate codegen: from `packages/backend`, `bunx convex codegen`. Then `bun run --filter @workspace/backend typecheck` and `bun run --filter @workspace/backend test`. Expected: PASS.

---

### Task 4: createUser requires an organization + role

**Files:** Modify `packages/backend/convex/platform/admin.ts` (`createUser`, lines ~39-71) + its test.

**Interfaces:** Produces `createUser({ name, email, orgId, role }) -> { authId, created }`. Task 5's dialog calls it.

- [ ] **Step 1:** Replace `createUser` with the org-requiring version (reuses `assertUserAndOrg`, `roleArg`, `addMember`, `PLATFORM_AUDIT_EVENTS.membershipGranted`, all already in the file):

```ts
export const createUser = platformMutation({
  args: {
    name: v.string(),
    email: v.string(),
    orgId: v.string(),
    role: roleArg,
  },
  returns: v.object({ authId: v.string(), created: v.boolean() }),
  handler: async (ctx, { name, email, orgId, role }) => {
    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()
    if (trimmedName === "" || trimmedEmail === "") {
      throw appError(ERROR_CODES.invalidInput)
    }
    const result = await ctx.runMutation(
      components.betterAuth.provisioning.provisionUser,
      { email: trimmedEmail, name: trimmedName }
    )
    await onUserCreate(ctx, {
      _id: result.userId,
      email: trimmedEmail,
      name: trimmedName,
    })
    if (result.created) {
      await logPlatformAudit(ctx, {
        actorId: ctx.authUserId,
        type: PLATFORM_AUDIT_EVENTS.userCreated,
        targetUserId: result.userId,
        payload: {},
      })
    }
    // Require + attach the org membership in the same mutation so a user is
    // never created without an organization. assertUserAndOrg throws notFound
    // if the org does not exist.
    await assertUserAndOrg(ctx, result.userId, orgId)
    const membership = await ctx.runMutation(
      components.betterAuth.provisioning.addMember,
      { organizationId: orgId, userId: result.userId, role }
    )
    if (membership.created) {
      await logPlatformAudit(ctx, {
        actorId: ctx.authUserId,
        type: PLATFORM_AUDIT_EVENTS.membershipGranted,
        targetUserId: result.userId,
        targetOrgId: orgId,
        payload: { role },
      })
    }
    return { authId: result.userId, created: result.created }
  },
})
```

- [ ] **Step 2:** Add/extend an `admin.test.ts` case: after seeding an org, `createUser({ name, email, orgId, role: "editor" })` makes the user a member of that org (assert via `listMembers`/the members query showing the user with role `editor`); a non-existent `orgId` throws (`notFound`). Mirror the existing platform/admin test setup for seeding an org. Run `bun run --filter @workspace/backend test`. Expected: PASS.

---

### Task 5: Create-user dialog (required org + role pickers)

**Files:** Modify `apps/dashboard/lib/admin-schemas.ts`, `apps/dashboard/components/admin/create-user-dialog.tsx` (+ its test), and the create-dialog i18n labels.

**Interfaces:** Consumes Task 4's `createUser({ name, email, orgId, role })` and `api.platform.admin.listOrganizations`.

- [ ] **Step 1:** `admin-schemas.ts` — extend `createUserSchema`:

```ts
export const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  orgId: z.string().min(1),
  role: z.enum(["admin", "editor"]),
})
```

- [ ] **Step 2:** i18n — add `dashboard.admin.users.create.orgLabel` and `.roleLabel` in all 5 locales (en: "Organization" / "Role"; sv: "Organisation" / "Roll"; nb: "Organisasjon" / "Rolle"; da: "Organisation" / "Rolle"; fi: "Organisaatio" / "Rooli"). Role option labels reuse the existing `accounts.role.admin` / `accounts.role.editor`.

- [ ] **Step 3:** Rewrite `create-user-dialog.tsx` to add the org `Select` (required, options from `useQuery(api.platform.admin.listOrganizations)`) and a role `Select` (default `"editor"`), and pass `orgId` + `role` to `createUser`. Use the `Select` family from `@workspace/ui/components/select` (mirror `families-review.tsx`). The submit stays gated by `createUserSchema.safeParse(...)`, which now requires `orgId`. Key changes: add `useQuery`, `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"`, state `orgId` (default `""`) and `role` (default `"editor"`), reset both on close, render the two selects after the email field with labels `t("orgLabel")`/`t("roleLabel")` and role options from `tAccounts("role.admin")`/`tAccounts("role.editor")` (`const tAccounts = useTranslations("accounts")`), and call:

```tsx
await createUser({
  name: parsed.data.name,
  email: parsed.data.email,
  orgId: parsed.data.orgId,
  role: parsed.data.role,
})
await authClient.requestPasswordReset({
  email: parsed.data.email,
  redirectTo: "/reset-password",
})
```
`parsed` becomes `createUserSchema.safeParse({ name, email, orgId, role })`. The org `SelectItem`s map over the `listOrganizations` result (`value={o.orgId}`, label `o.name`); show a disabled/empty state while the query is loading (`organizations === undefined`).

- [ ] **Step 4:** Update `create-user-dialog`'s test (if one exists; otherwise add one): the submit button is disabled until name, a valid email, and an org are chosen; submitting calls the mocked `createUser` with `{ name, email, orgId, role }` and then `requestPasswordReset`. Mock `convex/react`'s `useMutation`/`useQuery` and `@/lib/auth-client` as the existing admin tests do. Run `bun run --filter dashboard test -- create-user-dialog`. Expected: PASS.

---

### Final: verify, set env, present

- [ ] **Full gate:** `bun run typecheck && bun run test` — all packages PASS (i18n parity, email render, backend, dashboard).
- [ ] **Biome:** `bunx biome check` on every changed/new file; apply `--write` for any formatting.
- [ ] **Env (after approval):** `bunx convex env set EMAIL_FROM "blueprnt <hello@blueprnt.se>"` (Task 1 Step 2); verify with `bunx convex env get EMAIL_FROM`.
- [ ] **Present the full uncommitted diff for review.** Commit only after approval, suggested split: `feat(admin): require an organization when creating a user`, `feat(email): send a welcome email to new users instead of a reset`, `chore(email): send from a named hello@ address`. Never `--no-verify`.

## Self-Review

**1. Spec coverage:** welcome template + account-state branch (Tasks 2-3); org-agnostic copy (Task 2 body); require org + role atomically (Task 4) + dialog pickers (Task 5); named sender (Task 1); i18n in 5 locales + admin-log label (Tasks 2, 5); tests (Tasks 2-5); env + mailbox note (Task 1 / Final). All covered. ✓

**2. Placeholder scan:** Complete code for every code step; the only conditional guidance is Task 3 Step 3's test-harness fallback, which is an explicit, bounded instruction (verify the component `account` schema), not a placeholder. ✓

**3. Type consistency:** `welcome` key (Task 2) is the `templateKey` enqueued in Task 3 and rendered by the Task 2 `render.ts` case; `WelcomeEmail({url,locale})` matches `LinkEmailProps`; `hasPassword`/`userHasPassword` names match across Tasks 3 steps and the auth hook; `createUser({name,email,orgId,role})` (Task 4) matches the dialog call and `createUserSchema` (Task 5); `roleArg` = `admin|editor` matches the Zod `z.enum(["admin","editor"])`. ✓
