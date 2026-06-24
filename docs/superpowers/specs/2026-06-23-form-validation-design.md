# Design: standardize form validation on react-hook-form + zod + shadcn Form

Date: 2026-06-23
Status: Approved design, pending plan

## Problem

The dashboard has 13 forms/dialogs validated three inconsistent ways: a manual
Zod `safeParse` + `useState` (admin dialogs), HTML `required`/`type` only (auth),
or ad-hoc length checks (model/onboarding). None show per-field error messages.
We want one standard: per-field validation with inline errors, the shadcn way.

## Decision

Standardize on **react-hook-form + `@hookform/resolvers/zod` + the shadcn `Form`
component**, with `mode: "onTouched"` (a field's error appears after it is
blurred/touched, then updates live as the user types; a full check runs on
submit). The Convex backend stays the authoritative validator; this is the
client gate. Rejected: a custom `useZodForm` hook (re-creates RHF's
touched/revalidation/focus/array handling; non-standard) and TanStack Form (no
advantage here, not shadcn-canonical).

## Foundation

- Add deps to `apps/dashboard`: `react-hook-form` and `@hookform/resolvers`.
- Add the shadcn **`Form`** component at `packages/ui/src/components/form.tsx`
  (exports `Form, FormField, FormItem, FormLabel, FormControl, FormDescription,
  FormMessage, useFormField`). Add via the shadcn CLI if the repo's
  `components.json` resolves to `packages/ui`; otherwise add the canonical
  upstream `form.tsx` by hand (it is standard vendor code, excluded from Biome
  like the rest of `packages/ui/src/components`). It depends on `react-hook-form`
  and the existing `Label`.

## The standard pattern (codified in CLAUDE.md)

```tsx
const form = useForm<z.input<typeof schema>>({
  resolver: zodResolver(schema),
  mode: "onTouched",
  defaultValues,
})

// <Form {...form}>
//   <form onSubmit={form.handleSubmit(onSubmit)}>
//     <FormField control={form.control} name="email" render={({ field }) => (
//       <FormItem>
//         <FormLabel>{t("email")}</FormLabel>
//         <FormControl><Input {...field} /></FormControl>
//         <FormMessage />
//       </FormItem>
//     )} />
//     ...
//   </form>
// </Form>
```

- Per-field errors render via `FormMessage` (it reads the field error from RHF
  context). Field labels via `FormLabel` (wired to the control for a11y).
- Selects (including `CountrySelect`/`CurrencySelect`/`IndustrySelect`) wire
  through the `field` render prop: `<Select value={field.value}
  onValueChange={field.onChange}>` inside `FormControl`.
- The criterion anchors (array of 6) use `useFieldArray`.
- Submit buttons use the existing `SubmitButton` with
  `isSubmitting={form.formState.isSubmitting}`.
- Error MESSAGES are user-facing, so they must go through i18n (no hardcoded
  text) AND the shadcn `FormMessage` must stay vendor-pure (it renders the raw
  `error.message`; we do not customize it). The locked pattern is therefore a
  **schema factory**: each form schema is a function `makeXSchema(t)` that builds
  the Zod schema with already-translated messages (e.g. `z.string().min(1,
  t("required"))`). The form does `const schema = useMemo(() => makeXSchema(t),
  [t])`. Inferred type via `type XInput = z.input<ReturnType<typeof
  makeXSchema>>`.
- Shared validation messages live under a new i18n namespace
  **`dashboard.validation.*`** (`required`, `invalidEmail`, `minLength` with a
  `{min}` param, `passwordMin`, `slugInvalid`, `confirmMismatch`), added to all 5
  locales. Form-specific messages reuse the form's own namespace. The existing
  static schemas in `apps/dashboard/lib/admin-schemas.ts` become factories;
  non-form Zod schemas (`lib/suggestion-schemas.ts`, AI payloads) are untouched.

## CLAUDE.md

Replace the existing "Client-side validation uses Zod" bullet with the mandate:
forms use `react-hook-form` + `zodResolver` + the shadcn `Form` components, with
`mode: "onTouched"` and per-field `FormMessage`; the backend re-validates
independently. New forms follow this; ad-hoc `safeParse`/`useState` form
validation is not added.

## Scope: all 13 forms

Reuse the existing Zod schemas where present (`apps/dashboard/lib/admin-schemas.ts`:
`createUserSchema`, `createOrgSchema`, `orgSettingsSchema`); add schemas for the
rest (co-located with the form or in a shared `lib/*-schemas.ts`).

| Form | Schema | Notes |
|------|--------|-------|
| `create-user-dialog` | `createUserSchema` (exists) | org + role selects via `field`; keeps `SubmitButton` |
| `create-organization-dialog` | `createOrgSchema` (exists) | keep the name->slug auto-fill (set `slug` via `form.setValue` while untouched) |
| `manage-organization-dialog` (settings) | `orgSettingsSchema` (exists) | custom selects via `field` |
| `manage-user-organizations-dialog` (add form) | small new schema `{ orgId, role }` | the inline add-to-org form |
| `email-password-form` (sign-in) | new `{ email, password }` | `Field` -> `FormField` |
| `forgot-password` page | new `{ email }` | enumeration-safe submit unchanged |
| `reset-password` page | new `{ password: min 8 }` | keep the token gate |
| `create-role-dialog` | new `{ title, roleFunction, team, trackKey, familyId? }` | selects via `field` |
| `criterion-form` (+ add/edit dialog wrappers) | new `{ name, description?, helpText?, anchors: string[] }` | anchors via `useFieldArray` |
| `name-screen` (onboarding) | new `{ name: min 2 }` | `OnboardingInput` wrapped in `FormControl` |
| `model-setup-step` (scratch name) | new `{ scratchName: min 1 }` | |
| `delete-user-dialog` | new `z.object({ confirmText }).refine(v => v.confirmText === email)` | type-to-confirm |

## Testing

Each migrated form keeps or gains a test that: (1) a per-field error renders when
a field is touched and invalid, and (2) a valid submit calls the action/mutation
with the parsed values. Existing form tests are rewritten to the RHF pattern (the
manual `safeParse`/`disabled` assertions become RHF error/submit assertions).
i18n parity holds (any new message keys land in all 5 locales).

## Out of scope

- No backend validation changes (Convex re-validation stays as is).
- No visual redesign of the forms beyond swapping field wrappers to `FormItem`/
  `FormControl`/`FormMessage`.
- The migration runs as one task per form (foundation first), reviewed in chunks.
