# Form Validation Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the dashboard one form-validation standard: react-hook-form + Zod (`zodResolver`) + the shadcn `Form` components, with per-field inline errors, and migrate all data-entry forms to it.

**Architecture:** Add `react-hook-form` + `@hookform/resolvers` and the shadcn `Form` vendor component to `packages/ui`. Each form schema is a **factory** `makeXSchema(t)` that builds the Zod schema with translated messages, so `FormMessage` stays vendor-pure and all copy stays in i18n. Forms call `useForm({ resolver: zodResolver(schema), mode: "onTouched" })` and render `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`. The Convex backend remains the authoritative validator.

**Tech Stack:** Next.js 16 App Router, React 19, react-hook-form, @hookform/resolvers, Zod 4, next-intl 4, shadcn/ui (radix-ui unified), Vitest 4 + Testing Library.

## Global Constraints

Copied verbatim from the spec (`docs/superpowers/specs/2026-06-23-form-validation-design.md`) and `CLAUDE.md`. Every task implicitly includes these.

- **No AI/Claude attribution** in commits, code, or comments. Commits use Conventional Commits (`feat:`/`refactor:`/`docs:`), lowercase imperative summary, no trailing period.
- **Never use em dashes** (" — ") in any text we write (UI copy, comments, commit messages). Use a period, comma, colon, or parentheses.
- **All user-facing text goes through i18n.** New strings are added to `packages/i18n/messages/en.json` first, then mirrored to **every** other locale file (`sv`, `nb`, `da`, `fi`). The parity test fails if any locale's key set differs from `en`.
- **Non-ASCII locale strings (å ä ö æ ø etc.) are added with the Edit/Write tool only**, never via shell `perl`/`sed`/`echo` (they double-encode). After adding, grep for mojibake. Nordic strings are machine-translation drafts: flag them for native review in the commit body.
- **`FormMessage` and the `Form` component are shadcn vendor code** (`packages/ui/src/components/`): excluded from Biome, must stay diffable against upstream. Do not hand-edit them beyond the documented unified-radix `Slot.Root` import.
- **Validation revalidation mode is `onTouched`** for every migrated form (error shows after blur/touch, then updates live; full check on submit).
- **Leave completed work uncommitted for review** unless the user has approved a commit. The repo workflow is: implement, the user reviews, then commit. (This overrides the skill's "commit each task" steps: do the commit step only after the user approves the batch.)
- **The pre-commit hook** runs Biome on staged files, a full typecheck, and the full `turbo run test`. All three must pass; never bypass with `--no-verify`. Run `bun run test` (never `bun test`).
- **New code ships with tests in the same change.**

## Migration recipe (applies to every form task)

This is a migration of existing files, so each form task shows **the code that changes** (schema factory, `useForm` setup, the `<FormField>` blocks, the test) and references the unchanged shell (Dialog/Card/footer) by file and line. Task 2 (create-user-dialog) is the **canonical exemplar**: read it in full before any other form task; it shows the complete `<Form>`/`<FormField>`/`<FormControl>`/`<FormMessage>` structure, the Select-via-`field` wiring, the `SubmitButton` + `form.formState.isSubmitting` pattern, the submit-failure alert, and the test pattern. Later tasks describe only their deltas from that pattern, completely.

The standard structure each form adopts:

```tsx
const tv = useTranslations("dashboard.validation")
const schema = useMemo(() => makeXSchema(tv), [tv])
const form = useForm<z.input<typeof schema>>({
  resolver: zodResolver(schema),
  mode: "onTouched",
  defaultValues: { /* every field, no undefined */ },
})

async function onSubmit(values: z.output<typeof schema>) {
  setFailed(false)
  try {
    await mutation({ ...values })
    // close / redirect / reset
  } catch {
    setFailed(true)
  }
}

// <Form {...form}>
//   <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
//     <FormField control={form.control} name="field" render={({ field }) => (
//       <FormItem>
//         <FormLabel>{t("fieldLabel")}</FormLabel>
//         <FormControl><Input {...field} /></FormControl>
//         <FormMessage />
//       </FormItem>
//     )} />
//     {failed && <p role="alert" className="text-destructive text-sm">{t("error")}</p>}
//     <DialogFooter>
//       <Button type="button" variant="outline" onClick={...}>{t("cancel")}</Button>
//       <SubmitButton type="submit" isSubmitting={form.formState.isSubmitting}>{t("cta")}</SubmitButton>
//     </DialogFooter>
//   </form>
// </Form>
```

Notes that hold everywhere:
- `setPending`/`pending` state is removed; use `form.formState.isSubmitting`.
- The manual `safeParse`/`canSubmit`/`disabled` gating is removed; submit-time + `onTouched` validation replaces it. The submit button is NOT disabled on invalid (clicking it surfaces the errors); it is disabled only while submitting (handled by `SubmitButton`).
- Submit-failure (mutation threw) still uses a local `failed` boolean + the `role="alert"` paragraph; that is server/network failure, not field validation.
- A `Select` field renders `<Select value={field.value} onValueChange={field.onChange}>` with `FormControl` wrapping only the `SelectTrigger`, and the trigger carries `ref={field.ref} onBlur={field.onBlur}` so RHF focus-on-error and `onTouched` blur-validation work (a Select that forwards only value/onChange is validated only on submit and cannot receive focus-on-error). Canonical shape (from the exemplar):
  ```tsx
  <Select value={field.value} onValueChange={field.onChange}>
    <FormControl>
      <SelectTrigger ref={field.ref} onBlur={field.onBlur}>
        <SelectValue placeholder={...} />
      </SelectTrigger>
    </FormControl>
    <SelectContent>...</SelectContent>
  </Select>
  <FormMessage />
  ```
  This keeps Radix's hidden native `<select>` rendering inside the `<form>` so tests can `fireEvent.change` it. Custom selects (`CountrySelect` etc.) that only accept `value`/`onValueChange` forward those from `field`; pass `ref`/`onBlur` too if the component forwards them.

---

## Task 1: Foundation (deps, Form component, validation i18n, CLAUDE.md)

**Files:**
- Modify: `packages/ui/package.json` (add `react-hook-form`)
- Modify: `apps/dashboard/package.json` (add `@hookform/resolvers`)
- Create: `packages/ui/src/components/form.tsx` (vendor)
- Create: `apps/dashboard/lib/validation.ts` (the `ValidationT` type alias)
- Modify: `packages/i18n/messages/{en,sv,nb,da,fi}.json` (add `dashboard.validation`)
- Modify: `CLAUDE.md` (replace the Zod-validation bullet)
- Test: `packages/ui/src/components/form.test.tsx` (smoke test)

**Interfaces:**
- Produces: the `Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage, useFormField` exports from `@workspace/ui/components/form`; the `ValidationT` type from `@/lib/validation`; the `dashboard.validation.*` message keys.

- [ ] **Step 1: Add the dependencies**

```bash
cd /Volumes/development/blueprnt/frontend
# react-hook-form is used by the Form vendor component (lives in packages/ui)
cd packages/ui && bun add react-hook-form && cd ../..
# zodResolver is called in the app forms
cd apps/dashboard && bun add @hookform/resolvers && cd ../..
```
Expected: `react-hook-form` appears in `packages/ui/package.json` dependencies, `@hookform/resolvers` in `apps/dashboard/package.json` dependencies. `zod` is already a dashboard dep.

- [ ] **Step 2: Create the shadcn `Form` vendor component**

Create `packages/ui/src/components/form.tsx` with the canonical shadcn form component, using this repo's unified-radix `Slot.Root` convention (matches `button.tsx` line 3/54) and the `@workspace/ui/*` internal import aliases (matches `field.tsx`):

```tsx
"use client"

import * as React from "react"
import { Slot } from "radix-ui"
import {
  Controller,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
  useFormState,
} from "react-hook-form"

import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"

const Form = FormProvider

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue
)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext.name })
  const fieldState = getFieldState(fieldContext.name, formState)

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }

  const { id } = itemContext

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

type FormItemContextValue = {
  id: string
}

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue
)

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        data-slot="form-item"
        className={cn("grid gap-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

function FormControl({ ...props }: React.ComponentProps<typeof Slot.Root>) {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()

  return (
    <Slot.Root
      data-slot="form-control"
      id={formItemId}
      aria-describedby={
        error
          ? `${formDescriptionId} ${formMessageId}`
          : `${formDescriptionId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  )
}

function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function FormMessage({ className, ...props }: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error?.message ?? "") : props.children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
}
```

This file sits under `packages/ui/src/components/`, which is already excluded from Biome (vendor). Document in the commit body that it was added per the shadcn `form` registry item, adapted to the repo's unified-radix `Slot.Root` import.

- [ ] **Step 3: Create the `ValidationT` type alias**

Create `apps/dashboard/lib/validation.ts`:

```ts
import type { useTranslations } from "next-intl"

// The next-intl translator scoped to the shared validation namespace. Schema
// factories take this so Zod messages stay in i18n and keep their parameter
// typing (e.g. minLength's {min}). The form passes
// useTranslations("dashboard.validation") straight in.
export type ValidationT = ReturnType<
  typeof useTranslations<"dashboard.validation">
>
```

If TS rejects the instantiation-expression `typeof useTranslations<...>` form, fall back to an explicit signature in the same file:
```ts
export type ValidationT = (
  key: "required" | "invalidEmail" | "minLength" | "slug",
  values?: Record<string, string | number>
) => string
```

- [ ] **Step 4: Add the `dashboard.validation` messages to `en.json`**

In `packages/i18n/messages/en.json`, add a `validation` object inside `dashboard` (place it alphabetically/near the other dashboard sections; exact position is not significant):

```json
"validation": {
  "required": "This field is required.",
  "invalidEmail": "Enter a valid email address.",
  "minLength": "Must be at least {min} characters.",
  "slug": "Use lowercase letters, numbers, and hyphens."
}
```

- [ ] **Step 5: Mirror the messages to `sv`, `nb`, `da`, `fi` (Edit tool only)**

Add the same `dashboard.validation` block to each file using the Edit/Write tool (these contain non-ASCII; never use shell `sed`/`perl`/`echo`). Drafts (flag for native review in the commit body):

`sv.json`:
```json
"validation": {
  "required": "Det här fältet är obligatoriskt.",
  "invalidEmail": "Ange en giltig e-postadress.",
  "minLength": "Måste vara minst {min} tecken.",
  "slug": "Använd små bokstäver, siffror och bindestreck."
}
```
`nb.json`:
```json
"validation": {
  "required": "Dette feltet er påkrevd.",
  "invalidEmail": "Skriv inn en gyldig e-postadresse.",
  "minLength": "Må være minst {min} tegn.",
  "slug": "Bruk små bokstaver, tall og bindestrek."
}
```
`da.json`:
```json
"validation": {
  "required": "Dette felt er påkrævet.",
  "invalidEmail": "Indtast en gyldig e-mailadresse.",
  "minLength": "Skal være mindst {min} tegn.",
  "slug": "Brug små bogstaver, tal og bindestreger."
}
```
`fi.json`:
```json
"validation": {
  "required": "Tämä kenttä on pakollinen.",
  "invalidEmail": "Anna kelvollinen sähköpostiosoite.",
  "minLength": "Vähintään {min} merkkiä.",
  "slug": "Käytä pieniä kirjaimia, numeroita ja väliviivoja."
}
```

- [ ] **Step 6: Verify i18n parity and no mojibake**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter @workspace/i18n test
grep -RnE "Ã|Â|Ð|å|¤" packages/i18n/messages/*.json | grep -iE "validation" || echo "spot-check the validation block visually for double-encoding"
```
Expected: i18n parity test passes (all 5 locales have the same key set). Open each file's `validation` block and confirm the Nordic characters render correctly (ä, å, ø, æ), not as `Ã¤` etc.

- [ ] **Step 7: Write the Form component smoke test**

Create `packages/ui/src/components/form.test.tsx`. (Note: `packages/ui/src/components` is Biome-excluded vendor, but it is NOT test-excluded; a smoke test that the wiring renders errors is worth keeping.)

```tsx
import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./form"
import { Input } from "./input"

function Harness() {
  const form = useForm<{ name: string }>({ defaultValues: { name: "" } })
  // Seed an error so FormMessage has something to render.
  form.setError("name", { message: "Required field" })
  return (
    <Form {...form}>
      <form>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}

describe("Form", () => {
  it("renders a field's label, control, and error message", () => {
    render(<Harness />)
    const input = screen.getByLabelText("Name")
    expect(input).toBeDefined()
    expect(input.getAttribute("aria-invalid")).toBe("true")
    expect(screen.getByText("Required field")).toBeDefined()
  })
})
```

- [ ] **Step 8: Run the smoke test**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter @workspace/ui test -- form.test
```
Expected: PASS.

- [ ] **Step 9: Update `CLAUDE.md`**

Replace the existing bullet:
> - **Client-side validation uses Zod.** Encode form rules ... Zod is the client's gate.

with:
> - **Forms use react-hook-form + Zod + the shadcn `Form` components.** Every data-entry form uses `useForm({ resolver: zodResolver(schema), mode: "onTouched" })` and renders fields with `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` (`@workspace/ui/components/form`), so each field validates on blur and shows its error inline via `FormMessage`. Form schemas are **factories** `makeXSchema(t)` that build the Zod schema with translated messages (`t` is `useTranslations("dashboard.validation")`), so messages stay in i18n and `FormMessage` stays vendor-pure. Shared messages live under `dashboard.validation.*`. The submit button is not disabled on invalid input (clicking surfaces the errors); it disables only while submitting via `SubmitButton` + `form.formState.isSubmitting`. The backend always re-validates independently (Convex validators + `appError` codes); non-form payload schemas (`lib/suggestion-schemas.ts`) stay plain Zod.

- [ ] **Step 10: Typecheck the foundation**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard typecheck && bun run --filter @workspace/ui typecheck
```
Expected: no errors. (Do NOT commit yet; the user reviews batches. See the commit-after-approval note in Global Constraints.)

---

## Task 2: admin-schemas → factories + migrate create-user-dialog (EXEMPLAR)

**Files:**
- Modify: `apps/dashboard/lib/admin-schemas.ts`
- Modify: `apps/dashboard/components/admin/create-user-dialog.tsx`
- Test: `apps/dashboard/components/admin/create-user-dialog.test.tsx`

**Interfaces:**
- Consumes: `Form*` from `@workspace/ui/components/form`, `ValidationT` from `@/lib/validation`, `dashboard.validation.*`.
- Produces: `makeCreateUserSchema(t)`, `makeCreateOrgSchema(t)` factories; `CreateUserValues`, `CreateOrgValues` types; the canonical migration pattern.

- [ ] **Step 1: Convert the schemas to factories**

Rewrite `apps/dashboard/lib/admin-schemas.ts`:

```ts
import { SLUG_PATTERN } from "@workspace/constants"
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gates for the platform-admin forms. The backend re-validates with
// Convex validators + appError codes; these schemas drive the form and are the
// single client-side source of form rules. They are factories so messages are
// translated (FormMessage stays vendor-pure).

export function makeCreateUserSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    email: z.string().trim().toLowerCase().email(t("invalidEmail")),
    orgId: z.string().min(1, t("required")),
    role: z.enum(["admin", "editor"]),
  })
}
export type CreateUserValues = z.infer<ReturnType<typeof makeCreateUserSchema>>

// Lowercase letters, digits, hyphens: the slug doubles as the org's unique
// Better Auth identifier. The pattern is the shared SLUG_PATTERN.
export function makeCreateOrgSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    slug: z.string().trim().min(1, t("required")).regex(SLUG_PATTERN, t("slug")),
  })
}
export type CreateOrgValues = z.infer<ReturnType<typeof makeCreateOrgSchema>>

// All-optional settings: no messages needed, stays a plain schema.
export const orgSettingsSchema = z.object({
  country: z.string().trim().optional(),
  currency: z.string().trim().optional(),
  language: z.string().trim().optional(),
  industry: z.string().trim().optional(),
})
export type OrgSettingsValues = z.infer<typeof orgSettingsSchema>

export const membershipRole = z.enum(["admin", "editor"])
export type MembershipRole = z.infer<typeof membershipRole>
```

- [ ] **Step 2: Migrate `create-user-dialog.tsx` to RHF + Form**

Replace the field-state + manual-parse implementation with RHF. Full file:

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@workspace/ui/components/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useMutation, useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { SubmitButton } from "@/components/submit-button"
import { type CreateUserValues, makeCreateUserSchema } from "@/lib/admin-schemas"
import { authClient } from "@/lib/auth-client"

export function CreateUserDialog() {
  const t = useTranslations("dashboard.admin.users.create")
  const tAccounts = useTranslations("accounts")
  const tv = useTranslations("dashboard.validation")
  const createUser = useMutation(api.platform.admin.createUser)
  const organizations = useQuery(api.platform.admin.listOrganizations)
  const [open, setOpen] = useState(false)
  const [failed, setFailed] = useState(false)

  const schema = useMemo(() => makeCreateUserSchema(tv), [tv])
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", orgId: "", role: "editor" },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      form.reset()
      setFailed(false)
    }
  }

  async function onSubmit(values: z.output<typeof schema>) {
    setFailed(false)
    try {
      await createUser(values)
      // Send the set-password email. A failure here is non-fatal: the account
      // exists and the invite can be resent from the users table.
      await authClient.requestPasswordReset({
        email: values.email,
        redirectTo: "/reset-password",
      })
      handleOpenChange(false)
    } catch {
      setFailed(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>{t("cta")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emailLabel")}</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="orgId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("orgLabel")}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={organizations === undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("orgPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(organizations ?? []).map((o) => (
                        <SelectItem key={o.orgId} value={o.orgId}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("roleLabel")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="editor">
                        {tAccounts("role.editor")}
                      </SelectItem>
                      <SelectItem value="admin">
                        {tAccounts("role.admin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {failed && (
              <p role="alert" className="text-destructive text-sm">
                {t("error")}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <SubmitButton
                type="submit"
                isSubmitting={form.formState.isSubmitting}
              >
                {t("cta")}
              </SubmitButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

Note the **Select-in-Form shape**: `FormControl` wraps only the `SelectTrigger` (so the `aria-invalid`/id land on the trigger), and the whole `Select` carries `value`/`onValueChange` from `field`. Radix still renders the hidden native `<select>` for tests.

- [ ] **Step 3: Rewrite the test for the RHF behavior**

The old tests asserted `submitButton().disabled` from manual parse state. RHF does not disable on invalid; instead, submitting invalid shows messages and does not call the mutation. Rewrite `create-user-dialog.test.tsx` (keep the existing mocks block at the top, lines 1-58, unchanged; replace the `describe` body):

```tsx
describe("CreateUserDialog", () => {
  beforeEach(() => {
    createUserMock.mockReset()
    requestPasswordResetMock.mockReset()
    requestPasswordResetMock.mockResolvedValue({ error: null })
  })
  afterEach(() => {
    cleanup()
  })

  function hiddenSelects(): HTMLSelectElement[] {
    return Array.from(document.querySelectorAll("select"))
  }
  function submitForm() {
    const form = screen
      .getByLabelText(labels.nameLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
  }

  it("shows a field error and does not submit when name is empty", async () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "user@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-1" } })
    submitForm()
    await waitFor(() => {
      expect(createUserMock).not.toHaveBeenCalled()
      expect(
        screen.getByText(messages.dashboard.validation.required)
      ).toBeDefined()
    })
  })

  it("shows the invalid-email error when the email is malformed", async () => {
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "not-an-email" },
    })
    submitForm()
    await waitFor(() => {
      expect(
        screen.getByText(messages.dashboard.validation.invalidEmail)
      ).toBeDefined()
      expect(createUserMock).not.toHaveBeenCalled()
    })
  })

  it("calls createUser and requestPasswordReset with name, email, orgId, role", async () => {
    createUserMock.mockResolvedValue({ authId: "user-1", created: true })
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Alice" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "alice@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-1" } })
    if (selects[1]) fireEvent.change(selects[1], { target: { value: "admin" } })
    submitForm()
    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        name: "Alice",
        email: "alice@example.com",
        orgId: "org-1",
        role: "admin",
      })
    })
    await waitFor(() => {
      expect(requestPasswordResetMock).toHaveBeenCalledWith({
        email: "alice@example.com",
        redirectTo: "/reset-password",
      })
    })
  })

  it("uses editor as the default role", async () => {
    createUserMock.mockResolvedValue({ authId: "user-1", created: true })
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Bob" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "bob@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-2" } })
    submitForm()
    await waitFor(() => {
      expect(createUserMock).toHaveBeenCalledWith({
        name: "Bob",
        email: "bob@example.com",
        orgId: "org-2",
        role: "editor",
      })
    })
  })

  it("shows an error alert when createUser fails", async () => {
    createUserMock.mockRejectedValue(new Error("ConvexError: notFound"))
    renderDialog()
    openDialog()
    fireEvent.change(screen.getByLabelText(labels.nameLabel), {
      target: { value: "Carol" },
    })
    fireEvent.change(screen.getByLabelText(labels.emailLabel), {
      target: { value: "carol@example.com" },
    })
    const selects = hiddenSelects()
    if (selects[0]) fireEvent.change(selects[0], { target: { value: "org-1" } })
    submitForm()
    await waitFor(() => {
      expect(screen.getByText(labels.error)).toBeDefined()
    })
  })
})
```
(`messages` is already imported at the top of the file; `labels.error` = `messages.dashboard.admin.users.create.error`.)

- [ ] **Step 4: Run the test + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- create-user-dialog
bun run --filter dashboard typecheck
```
Expected: all create-user-dialog tests PASS; typecheck clean. If `zodResolver` complains about the schema input/output generic, type `useForm<z.input<typeof schema>>` and `onSubmit(values: z.output<typeof schema>)`; `CreateUserValues` (= infer) equals the output type here since there are no transforms beyond trim/lowercase (which keep `string`).

---

## Task 3: create-organization-dialog (name → slug autofill)

**Files:**
- Modify: `apps/dashboard/components/admin/create-organization-dialog.tsx`
- Test: `apps/dashboard/components/admin/create-organization-dialog.test.tsx`

**Interfaces:** Consumes `makeCreateOrgSchema` (Task 2). Follows the Task 2 exemplar.

- [ ] **Step 1: Migrate the component**

Apply the exemplar pattern with two text fields (`name`, `slug`). Preserve the **slug auto-fill**: while the slug field has not been edited by the user, typing the name sets the slug. With RHF, track `slugEdited` in local state and use `form.setValue`:

```tsx
const tv = useTranslations("dashboard.validation")
const schema = useMemo(() => makeCreateOrgSchema(tv), [tv])
const form = useForm<CreateOrgValues>({
  resolver: zodResolver(schema),
  mode: "onTouched",
  defaultValues: { name: "", slug: "" },
})
const [slugEdited, setSlugEdited] = useState(false)
```

Name field `render`:
```tsx
<FormField control={form.control} name="name" render={({ field }) => (
  <FormItem>
    <FormLabel>{t("nameLabel")}</FormLabel>
    <FormControl>
      <Input
        {...field}
        onChange={(event) => {
          field.onChange(event)
          if (!slugEdited) {
            form.setValue("slug", slugify(event.target.value), {
              shouldValidate: form.formState.isSubmitted,
            })
          }
        }}
      />
    </FormControl>
    <FormMessage />
  </FormItem>
)} />
```

Slug field `render`:
```tsx
<FormField control={form.control} name="slug" render={({ field }) => (
  <FormItem>
    <FormLabel>{t("slugLabel")}</FormLabel>
    <FormControl>
      <Input
        {...field}
        onChange={(event) => {
          field.onChange(event)
          setSlugEdited(true)
        }}
      />
    </FormControl>
    <FormMessage />
  </FormItem>
)} />
```

`onSubmit` calls `await createOrg(values)` then `handleOpenChange(false)`; `handleOpenChange(false)` runs `form.reset()`, `setSlugEdited(false)`, `setFailed(false)`. Keep the `slugify` import from `@workspace/constants`. Footer uses `SubmitButton` with `form.formState.isSubmitting`.

- [ ] **Step 2: Update the test**

Read the current `create-organization-dialog.test.tsx` to keep its mocks. Replace disabled-button assertions with: (a) submit empty → `createOrgMock` not called + `dashboard.validation.required` shown; (b) type a name → assert the slug input value auto-fills to the slugified name (`expect((screen.getByLabelText(labels.slugLabel) as HTMLInputElement).value).toBe("kanonkula-ab")` after typing "Kanonkula AB"); (c) valid submit → `createOrgMock` called with `{ name, slug }`.

- [ ] **Step 3: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- create-organization-dialog
bun run --filter dashboard typecheck
```
Expected: PASS, clean.

---

## Task 4: manage-organization-dialog (settings form)

**Files:**
- Modify: `apps/dashboard/components/admin/manage-organization-dialog.tsx`
- Test: `apps/dashboard/components/admin/manage-organization-dialog.test.tsx`

**Interfaces:** Uses the existing static `orgSettingsSchema` (all-optional, no messages). The members list section (lines 126-190) is NOT a form: leave it unchanged.

- [ ] **Step 1: Migrate only the settings section to RHF**

The settings section has four custom selects (`CountrySelect`, `CurrencySelect`, `IndustrySelect`, and a country-derived language select). Replace the four `useState`s + `handleSaveSettings` with one form:

```tsx
const form = useForm<OrgSettingsValues>({
  resolver: zodResolver(orgSettingsSchema),
  mode: "onTouched",
  defaultValues: {
    country: org.country ?? "",
    currency: org.currency ?? "",
    language: org.language ?? "",
    industry: org.industry ?? "",
  },
})

async function onSubmit(values: OrgSettingsValues) {
  setError(false)
  try {
    await updateOrg({ orgId: org.orgId, ...values })
  } catch {
    setError(true)
  }
}
```

Wrap the settings `<section>` + footer save action in `<Form {...form}><form onSubmit={form.handleSubmit(onSubmit)}>`. Each custom select becomes a `FormField`. The custom selects take `value`/`onValueChange`, so wire them straight to `field`. The language select is special: it displays `countryForLanguage(field.value)` and on change maps the picked country back to a language:

```tsx
<FormField control={form.control} name="language" render={({ field }) => (
  <FormItem>
    <FormLabel>{t("languageLabel")}</FormLabel>
    <FormControl>
      <CountrySelect
        value={countryForLanguage(field.value ?? "") ?? ""}
        onValueChange={(code) =>
          field.onChange(LANGUAGE_BY_COUNTRY[code as CountryKey])
        }
        placeholder={t("languagePlaceholder")}
        aria-label={t("languageLabel")}
      />
    </FormControl>
    <FormMessage />
  </FormItem>
)} />
```
The other three (`country`, `currency`, `industry`) wire `value={field.value ?? ""} onValueChange={field.onChange}`. The save button moves into the form (its own `<form>` submit) using `SubmitButton` with `form.formState.isSubmitting`; the dialog's Close button stays a plain footer button. Since the members section and settings section have separate concerns, keep the `error` boolean shared as today (it covers member-action failures too).

NOTE: there are two footer actions today (Close + Save). The Save must be a submit inside the settings `<form>`. Keep Close outside as `type="button"`. If the DialogFooter must hold both, render the settings `<form>` to include the footer, or use `form="<id>"` association. Simplest: give the settings `<form>` an `id="org-settings-form"` and set the footer `SubmitButton` `form="org-settings-form"`.

- [ ] **Step 2: Update the test**

Read the current test for its mocks. Keep member-list assertions. For settings: change a select, submit, assert `updateOrgMock` called with the four values. Optional-only fields means there are no required-error assertions here.

- [ ] **Step 3: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- manage-organization-dialog
bun run --filter dashboard typecheck
```

---

## Task 5: manage-user-organizations-dialog (add-to-org form)

**Files:**
- Modify: `apps/dashboard/components/admin/manage-user-organizations-dialog.tsx`
- Modify: `apps/dashboard/lib/admin-schemas.ts` (add a tiny add-membership schema)
- Test: `apps/dashboard/components/admin/manage-user-organizations-dialog.test.tsx`

**Interfaces:** The current dialog (read in full earlier) has a memberships list section + an inline add form (lines 184-232). Only the add form migrates. The list + role-change + remove handlers stay.

- [ ] **Step 1: Add the schema factory**

In `admin-schemas.ts`:
```ts
export function makeAddMembershipSchema(t: ValidationT) {
  return z.object({
    orgId: z.string().min(1, t("required")),
    role: z.enum(["admin", "editor"]),
  })
}
export type AddMembershipValues = z.infer<ReturnType<typeof makeAddMembershipSchema>>
```

- [ ] **Step 2: Migrate the add form**

Replace `addOrgId`/`addRole`/`busy` state + `handleAdd` with a form (`mode: "onTouched"`, defaults `{ orgId: "", role: "editor" }`). The two selects become `FormField`s following the exemplar's Select shape; the inline layout (`flex flex-wrap items-end gap-2` with the label-spacer alignment) is preserved by keeping the same wrapper divs but swapping `Label`+`Select` for `FormItem`+`FormLabel`+`Select`. The submit `Button` becomes `SubmitButton` with `form.formState.isSubmitting`; on success call `form.reset({ orgId: "", role: "editor" })`. Keep the `noOrgsAvailable` empty-state branch (do not render the form when `addableOrgs` is empty). The shared `error` boolean stays for role-change/remove failures.

- [ ] **Step 3: Update the test**

Keep mocks + list assertions. For the add form: select an org, submit, assert `addMembershipMock` called with `{ authId, orgId, role }`. (No required-error test needed since the org select defaults empty and submitting empty just shows `required` + does not call the mock; add that assertion.)

- [ ] **Step 4: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- manage-user-organizations-dialog
bun run --filter dashboard typecheck
```

---

## Task 6: email-password-form (sign-in)

**Files:**
- Create: `apps/dashboard/lib/auth-schemas.ts`
- Modify: `apps/dashboard/components/auth/email-password-form.tsx`
- Test: `apps/dashboard/components/auth/email-password-form.test.tsx`

**Interfaces:** The form currently uses `Field`/`FieldLabel`/`FieldGroup` + uncontrolled inputs + `FormData`. It exposes `EmailPasswordValues` + an `onSubmit` prop (keep that contract). Migrate to RHF + `Form` inside the existing `Card`.

- [ ] **Step 1: Create the auth schemas file**

```ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

export function makeSignInSchema(t: ValidationT) {
  return z.object({
    email: z.string().trim().email(t("invalidEmail")),
    password: z.string().min(1, t("required")),
  })
}
export type SignInValues = z.infer<ReturnType<typeof makeSignInSchema>>

export function makeForgotPasswordSchema(t: ValidationT) {
  return z.object({ email: z.string().trim().email(t("invalidEmail")) })
}
export type ForgotPasswordValues = z.infer<
  ReturnType<typeof makeForgotPasswordSchema>
>

// Mirrors better-auth's minPasswordLength (server stays authoritative).
export const MIN_PASSWORD_LENGTH = 8
export function makeResetPasswordSchema(t: ValidationT) {
  return z.object({
    password: z
      .string()
      .min(MIN_PASSWORD_LENGTH, t("minLength", { min: MIN_PASSWORD_LENGTH })),
  })
}
export type ResetPasswordValues = z.infer<
  ReturnType<typeof makeResetPasswordSchema>
>
```

- [ ] **Step 2: Migrate the component**

Keep the `Card`/`CardHeader`/`CardContent` shell, the forgot-password `Link`, and the `error` boolean (wrong-credentials). Replace `Field`/`FieldLabel` + uncontrolled inputs with RHF. The `onSubmit` prop stays `(values: EmailPasswordValues) => Promise<void>`; map RHF's submit to it. `email` and `password` fields use the exemplar text-field pattern. The submit becomes `SubmitButton` with `form.formState.isSubmitting`. Per-field messages now show "invalid email" / "required" before the network call.

```tsx
const tv = useTranslations("dashboard.validation")
const schema = useMemo(() => makeSignInSchema(tv), [tv])
const form = useForm<SignInValues>({
  resolver: zodResolver(schema),
  mode: "onTouched",
  defaultValues: { email: "", password: "" },
})
async function onValid(values: SignInValues) {
  setError(false)
  try {
    await props.onSubmit(values)
  } catch {
    setError(true)
  }
}
```
Password field uses `<Input type="password" {...field} />`.

- [ ] **Step 3: Update the test**

The existing test (read earlier) checks the fields render + the forgot link. Keep those (labels still resolve via `FormLabel`). Add: submit with a bad email → `dashboard.validation.invalidEmail` shows and `onSubmit` is not called (pass a spy as `onSubmit`). Add: valid submit calls `onSubmit` with `{ email, password }`.

- [ ] **Step 4: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- email-password-form
bun run --filter dashboard typecheck
```

---

## Task 7: forgot-password page

**Files:**
- Modify: `apps/dashboard/app/forgot-password/page.tsx`
- Test: `apps/dashboard/app/forgot-password/page.test.tsx` (create)

**Interfaces:** Uses `makeForgotPasswordSchema` (Task 6). The page keeps its `submitted` enumeration-safe confirmation branch and the `Logo`/`Card` shell.

- [ ] **Step 1: Migrate**

Replace the `FormData` handler + `Field` with RHF (`mode: "onTouched"`, default `{ email: "" }`) inside the existing `<form>`. The single email field uses the exemplar text-field pattern. `onSubmit` runs the enumeration-safe `requestPasswordReset` in a try/catch that ALWAYS sets `submitted` true (preserve the existing comment about enumeration safety). The submit button becomes `SubmitButton` with `form.formState.isSubmitting`. Keep the `backToSignIn` links and the `submitted` confirmation `role="status"` paragraph.

- [ ] **Step 2: Add a test**

Create a test mirroring `email-password-form.test.tsx` setup (mock `next/link`, mock `@/lib/auth-client`'s `authClient.requestPasswordReset`, mock `@/hooks/use-page-title` if it touches the router). Assert: bad email shows `invalidEmail` and does not call `requestPasswordReset`; valid email calls it with `{ email, redirectTo: "/reset-password" }` and then shows the confirmation (`t("confirmation")`). Also assert that when `requestPasswordReset` rejects, the confirmation still shows (enumeration-safe).

- [ ] **Step 3: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- forgot-password
bun run --filter dashboard typecheck
```

---

## Task 8: reset-password page

**Files:**
- Modify: `apps/dashboard/app/reset-password/page.tsx`
- Test: `apps/dashboard/app/reset-password/page.test.tsx` (create)

**Interfaces:** Uses `makeResetPasswordSchema` + `MIN_PASSWORD_LENGTH` (Task 6). Keep the `token === null` missing-token branch and the `Suspense` wrapper.

- [ ] **Step 1: Migrate**

Replace `password`/`pending` state + the manual length check with RHF (`mode: "onTouched"`, default `{ password: "" }`). The password field uses `<Input type="password" {...field} />` and now shows the `minLength` message inline (better than a silently-disabled button). `onSubmit` calls `authClient.resetPassword({ newPassword: values.password, token })`; on `resetError` set `error` true; on success `router.push("/")`. Submit becomes `SubmitButton` with `form.formState.isSubmitting`. Delete the local `MIN_PASSWORD_LENGTH` const (now imported from `auth-schemas`).

- [ ] **Step 2: Add a test**

Mock `next/navigation` (`useRouter`, `useSearchParams` returning a token), mock `@/lib/auth-client`. Assert: a too-short password shows `minLength` and does not call `resetPassword`; a valid password calls `resetPassword` with `{ newPassword, token }` and pushes `/`; a `resetError` shows the error alert. Also assert the missing-token branch renders `t("missingToken")` when `useSearchParams` has no token.

- [ ] **Step 3: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- reset-password
bun run --filter dashboard typecheck
```

---

## Task 9: create-role-dialog

**Files:**
- Create/modify: add `makeCreateRoleSchema` to a `apps/dashboard/lib/role-schemas.ts`
- Modify: `apps/dashboard/components/roles/create-role-dialog.tsx`
- Test: `apps/dashboard/components/roles/create-role-dialog.test.tsx`

**Interfaces:** The dialog has `title`, `roleFunction`, `team` (text, required), `trackKey` (Select over `tracks`, required), and `familyId` (custom `FamilyPicker`, optional, defaults `null`). The `HelpMorphButton`s next to the track/family labels must be preserved.

- [ ] **Step 1: Add the schema factory**

```ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

export function makeCreateRoleSchema(t: ValidationT) {
  return z.object({
    title: z.string().trim().min(1, t("required")),
    roleFunction: z.string().trim().min(1, t("required")),
    team: z.string().trim().min(1, t("required")),
    trackKey: z.enum(["IC", "Lead", "M"], { message: t("required") }),
    familyId: z.string().nullable(),
  })
}
export type CreateRoleValues = z.infer<ReturnType<typeof makeCreateRoleSchema>>
```
Note: `trackKey` is the fixed V1 union (ADR-0006). The empty-string default (no track) must fail; `z.enum` with the message handles the empty case. Default `trackKey` to `tracks[0]?.key ?? ""` cast through the form's input type, or default to the first track key (the component already does `firstTrack?.key`).

- [ ] **Step 2: Migrate the component**

Defaults: `{ title: "", roleFunction: "", team: "", trackKey: firstTrack?.key ?? "", familyId: null }`. The three text fields and the track Select follow the exemplar. The track field keeps its `HelpMorphButton`:
```tsx
<FormField control={form.control} name="trackKey" render={({ field }) => (
  <FormItem>
    <div className="flex items-center gap-1.5">
      <FormLabel>{t("trackLabel")}</FormLabel>
      <HelpMorphButton label={tHelp("trackLabel")}>{tHelp("trackBody")}</HelpMorphButton>
    </div>
    <Select value={field.value} onValueChange={field.onChange}>
      <FormControl><SelectTrigger className="w-full"><SelectValue /></SelectTrigger></FormControl>
      <SelectContent>
        {tracks.map((track) => (
          <SelectItem key={track.key} value={track.key}>{track.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <FormMessage />
  </FormItem>
)} />
```
The family field wraps `FamilyPicker` in a `FormField` (no `FormMessage` needed since it is optional), preserving its `HelpMorphButton`:
```tsx
<FormField control={form.control} name="familyId" render={({ field }) => (
  <FormItem>
    <div className="flex items-center gap-1.5">
      <FormLabel>{tModel("roleFamily")}</FormLabel>
      <HelpMorphButton label={tHelp("familyLabel")}>{tHelp("familyBody")}</HelpMorphButton>
    </div>
    <FamilyPicker orgId={orgId} value={field.value} onChange={field.onChange} />
  </FormItem>
)} />
```
`onSubmit` calls `createRole` with `{ orgId, title, function: values.roleFunction, team, trackKey, ...(values.familyId !== null ? { familyId: values.familyId as never } : {}) }`, then `setOpen(false)` + `router.push('/roles/' + roleId)`. Note the mapping `roleFunction → function` (the mutation arg is `function`). Footer uses `SubmitButton`.

- [ ] **Step 3: Update the test**

Read the current test for mocks (`createRole` mutation, `router.push`, `tracks` prop). Replace canSubmit/disabled checks with: submit empty → `required` shown on title + `createRole` not called; valid submit → `createRole` called with the mapped args (including `function`) and `router.push` to the new role.

- [ ] **Step 4: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- create-role-dialog
bun run --filter dashboard typecheck
```

---

## Task 10: criterion-form (anchors via useFieldArray)

**Files:**
- Create: add `makeCriterionSchema` to `apps/dashboard/lib/criterion-schemas.ts`
- Modify: `apps/dashboard/components/model/criterion-form.tsx`
- Test: `apps/dashboard/components/model/criterion-form.test.tsx`
- (add-criterion-dialog.tsx / edit-criterion-dialog.tsx are unchanged: they pass `initialValues`/`onSubmit`/`submitLabel`/`onCancel`, which the migrated form keeps.)

**Interfaces:** `CriterionForm` keeps its prop contract (`initialValues?`, `submitLabel`, `onSubmit`, `onCancel?`) and its reset-after-add behavior (when `initialValues === undefined`, clear the fields on success). Fields: `name` (required), `description` (optional textarea), `helpText` (optional textarea), `anchors` (fixed 6 strings, optional content).

- [ ] **Step 1: Add the schema factory**

```ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

export function makeCriterionSchema(t: ValidationT) {
  return z.object({
    name: z.string().trim().min(1, t("required")),
    description: z.string(),
    helpText: z.string(),
    anchors: z.array(z.string()).length(6),
  })
}
export type CriterionSchemaValues = z.infer<ReturnType<typeof makeCriterionSchema>>
```
(The existing `CriterionFormValues` interface in the component stays as the `onSubmit` payload type; it is structurally equal.)

- [ ] **Step 2: Migrate the component**

Defaults from `initialValues` or `{ name: "", description: "", helpText: "", anchors: ["","","","","",""] }`. Use `useForm` + `useFieldArray({ control: form.control, name: "anchors" })`? Note: `useFieldArray` needs array of objects to be ergonomic; for an array of plain strings, simpler to register each index directly via `form.register(\`anchors.\${index}\`)` inside the existing `.map`. Keep the fixed-length positional map exactly as today (the badge, endpoint tags, `aria-label`, placeholders all stay); only swap the controlled `value/onChange` for `{...form.register(\`anchors.\${index}\`)}`. The `name` field uses the exemplar text pattern with `FormMessage`; `description`/`helpText` use `<Textarea {...form.register("description")} />` inside `FormItem`/`FormLabel` (no `FormMessage`, optional). On submit success with `initialValues === undefined`, call `form.reset({ name: "", description: "", helpText: "", anchors: ["","","","","",""] })`. Keep the `failed` alert + the `DialogFooter` with `onCancel` and a `SubmitButton`.

Because `anchors` registration uses dotted paths, the `name` field is the only one that needs `FormField`/`FormMessage`; the rest can use `form.register` directly inside the existing markup to minimize churn. This is acceptable: the per-field error requirement applies to fields that HAVE validation messages (only `name` here).

- [ ] **Step 3: Update the test**

Read the current test for how it drives the fields (it uses `getByLabelText("Level N")` for anchors and the name label). Adjust: submit with empty name → `required` shown + `onSubmit` not called; fill name + some anchors → `onSubmit` called with `{ name, description, helpText, anchors }` (six entries). Keep the add-mode reset assertion if present.

- [ ] **Step 4: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- criterion
bun run --filter dashboard typecheck
```
(`-- criterion` matches criterion-form + add/edit dialog tests; all must stay green since the wrapper contract is unchanged.)

---

## Task 11: name-screen (onboarding)

**Files:**
- Create: add `makeOrgNameSchema` to `apps/dashboard/lib/onboarding-schemas.ts`
- Modify: `apps/dashboard/components/onboarding/name-screen.tsx`
- Test: `apps/dashboard/components/onboarding/name-screen.test.tsx`

**Interfaces:** One field (`name`, min 2). Keep the `ScreenShell`, the centered `OnboardingInput`, the `NextButton`, and the create-vs-rename `handleContinue` logic + `failed` alert. This screen has a bespoke conversational aesthetic: use RHF but keep `OnboardingInput` and `NextButton`; the per-field error shows below the input.

- [ ] **Step 1: Add the schema factory**

```ts
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

export function makeOrgNameSchema(t: ValidationT) {
  return z.object({ name: z.string().trim().min(2, t("minLength", { min: 2 })) })
}
export type OrgNameValues = z.infer<ReturnType<typeof makeOrgNameSchema>>
```

- [ ] **Step 2: Migrate**

`useForm({ resolver, mode: "onTouched", defaultValues: { name: existing?.name ?? "" } })`. Wrap in `<Form {...form}><form onSubmit={form.handleSubmit(onContinue)} className="flex w-full flex-col items-center gap-6">`. The name field is a `FormField` whose `FormControl` wraps `OnboardingInput`:
```tsx
<FormField control={form.control} name="name" render={({ field }) => (
  <FormItem className="flex w-full max-w-sm flex-col items-center">
    <FormControl>
      <OnboardingInput aria-label={t("nameLabel")} placeholder={t("namePlaceholder")} className="max-w-sm text-center" {...field} />
    </FormControl>
    <FormMessage />
  </FormItem>
)} />
```
`onContinue(values)` runs the existing create/rename branch using `values.name.trim()`; keep `failed` for the server-error alert and `NextButton type="submit"` (no longer `disabled` on short input; RHF surfaces the message instead) with `disabled={form.formState.isSubmitting}`.

- [ ] **Step 3: Update the test**

Read the current test for how it mocks `authClient.organization.create/update` and `onAdvance`. Replace the disabled-until-2-chars assertion with: submitting a 1-char name shows `minLength` and does not call create; a valid name calls create (or update) and `onAdvance`.

- [ ] **Step 4: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- name-screen
bun run --filter dashboard typecheck
```

---

## Task 12: model-setup-step (scratch name)

**Files:**
- Modify: `apps/dashboard/components/onboarding/model-setup-step.tsx`
- Test: `apps/dashboard/components/onboarding/model-setup-step.test.tsx`

**Interfaces:** Only the scratch-name `<form>` inside the `AnimatePresence` (lines 192-219) is a form; the choice cards + template path are not. Reuse the onboarding schema namespace.

- [ ] **Step 1: Add the scratch-name schema**

In `apps/dashboard/lib/onboarding-schemas.ts`:
```ts
export function makeScratchNameSchema(t: ValidationT) {
  return z.object({ scratchName: z.string().trim().min(1, t("required")) })
}
export type ScratchNameValues = z.infer<ReturnType<typeof makeScratchNameSchema>>
```

- [ ] **Step 2: Migrate the scratch form only**

Add the form hook at the top of the component (hooks must be unconditional). Replace `scratchName`/`setScratchName` state with the RHF form; `confirmScratch` becomes the resolver-validated submit calling `createEmpty({ orgId, name: values.scratchName.trim() })` then `setMode("scratch-editor")`. The `pickScratch` deselect path should `form.reset({ scratchName: "" })`. Inside the `motion.div`, wrap the existing `<form>` in `<Form {...form}>` and convert the single field to `FormField` + `OnboardingInput` + `FormMessage`. `NextButton type="submit"` uses `disabled={form.formState.isSubmitting}` (drop the length check; RHF surfaces `required`). Keep the shared `failed` alert and the `pending` flow for the template path (the template path is separate; do not route it through the form, but you may keep a `pending` boolean only if still needed for the template card; `confirmScratch` now uses `form.formState.isSubmitting`).

- [ ] **Step 3: Update the test**

Read the current test for how it reaches the scratch form (click the scratch `OptionCard`, then the name input appears). Replace the empty-name disabled assertion with: submit empty scratch name shows `required` and does not call `createEmpty`; valid name calls `createEmpty({ orgId, name })`.

- [ ] **Step 4: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- model-setup-step
bun run --filter dashboard typecheck
```

---

## Task 13: delete-user-dialog (type-to-confirm gate)

**Files:**
- Modify: `apps/dashboard/components/admin/delete-user-dialog.tsx`
- Test: `apps/dashboard/components/admin/delete-user-dialog.test.tsx` (create if absent)

**Interfaces:** This is an `AlertDialog` with no `<form>`; the action is `AlertDialogAction`. RHF is used as the validation source of truth, but per the spec there is **no nagging inline error** (the label already says "type {email} to confirm"); the action is gated on `form.formState.isValid`.

- [ ] **Step 1: Migrate to RHF without a FormMessage**

Build a schema inline (it depends on the runtime `email` prop, so it is not a shared factory):
```tsx
const schema = useMemo(
  () =>
    z.object({
      confirmText: z.string().refine((v) => v.trim() === props.email),
    }),
  [props.email]
)
const form = useForm<{ confirmText: string }>({
  resolver: zodResolver(schema),
  mode: "onChange",
  defaultValues: { confirmText: "" },
})
const confirmed = form.formState.isValid
```
Wrap the confirm `Input` in `<Form {...form}>` + a `FormField` with `FormControl` (keep the existing `Label`/`htmlFor` association via `FormLabel` text `t("confirmLabel", { email })`); **omit `FormMessage`** (no inline nag). The `AlertDialogAction` stays gated `disabled={!confirmed || busy}` and still uses `event.preventDefault()` + `void handleDelete()`. On close, `form.reset()`. Keep the `failed` alert. Use `mode: "onChange"` so `isValid` tracks each keystroke (this is a gate, not blur-validation).

- [ ] **Step 2: Add a test**

Render the dialog `open`. Assert: with empty/incorrect confirm text the action button is disabled; typing the exact email enables it; clicking it calls `deleteUser({ authId })`; a rejected `deleteUser` shows the error alert.

- [ ] **Step 3: Run + typecheck**

```bash
cd /Volumes/development/blueprnt/frontend
bun run --filter dashboard test -- delete-user-dialog
bun run --filter dashboard typecheck
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck, lint, and test**

```bash
cd /Volumes/development/blueprnt/frontend
bun run typecheck 2>/dev/null || bunx turbo run typecheck
bunx turbo run test
bunx biome check apps/dashboard packages/ui packages/i18n
```
Expected: typecheck clean across packages; all tests pass (i18n parity included); Biome clean on the non-vendor files. (`packages/ui/src/components/form.tsx` is Biome-excluded vendor.)

- [ ] **Step 2: Grep for leftover manual-validation patterns in migrated forms**

```bash
cd /Volumes/development/blueprnt/frontend
grep -Rn "safeParse" apps/dashboard/components apps/dashboard/app | grep -v ".test." || echo "no manual safeParse left in form components"
```
Expected: no `safeParse` left in the migrated form components (only the backend / non-form schemas use it).

- [ ] **Step 3: Hand off to the user for review**

Per the repo workflow, leave everything uncommitted and summarize the batch for the user's review. Commit only after approval, as a focused set of conventional commits (e.g. `feat(ui): add shadcn Form component`, `refactor(dashboard): migrate forms to react-hook-form + zod`, `docs: record the form-validation standard`). Flag the Nordic `dashboard.validation` strings for native review in the commit body.

---

## Self-Review notes

- **Spec coverage:** Foundation (Task 1) = spec "Foundation" + "CLAUDE.md" + the `dashboard.validation` namespace. Tasks 2-13 = the 12 forms in the spec scope table (create-user, create-org, manage-org settings, manage-user-orgs add, sign-in, forgot, reset, create-role, criterion, name-screen, model-setup scratch, delete-user). Task 14 = the testing/parity gate. The schema-factory + `onTouched` + vendor-pure-`FormMessage` decisions from the spec are encoded in the recipe + Task 1.
- **Out-of-scope confirmed:** `families-step` (AI paste/review, no field validation), `country/industry/score/rating` onboarding screens (pickers/steppers), and non-form Zod (`suggestion-schemas.ts`) are intentionally untouched.
- **Type consistency:** factory names (`makeCreateUserSchema`, `makeCreateOrgSchema`, `makeAddMembershipSchema`, `makeSignInSchema`, `makeForgotPasswordSchema`, `makeResetPasswordSchema`, `makeCreateRoleSchema`, `makeCriterionSchema`, `makeOrgNameSchema`, `makeScratchNameSchema`) and `ValidationT` are used consistently. `SubmitButton`'s `isSubmitting` prop matches its signature (`apps/dashboard/components/submit-button.tsx`).
- **Known execution risk:** the `ValidationT = ReturnType<typeof useTranslations<...>>` instantiation expression (Task 1 Step 3) has a documented fallback. The Select-in-`FormControl` shape (exemplar) keeps Radix's hidden native `<select>` so existing `fireEvent.change(select)` test helpers keep working; verify in Task 2 before replicating.
