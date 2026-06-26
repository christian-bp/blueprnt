# Mandatory Two-Factor Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require every user to set up a second factor (authenticator app or email codes) before using the app, and challenge for it on every sign-in.

**Architecture:** Use Better Auth's `twoFactor` plugin (server) + `twoFactorClient` (client). A new `TwoFactorGate` in the authenticated app layout blocks the app until the user has a confirmed factor, recorded by our own `mfaConfirmedAt` marker on the `users` mirror (Better Auth's `twoFactorEnabled` flips early under `skipVerificationOnEnable`, so it is not the completion signal). Sign-in transitions to a challenge phase when Better Auth returns `twoFactorRedirect`. Email codes are delivered through the existing Sweego + React Email pipeline.

**Tech Stack:** Convex, `better-auth@1.6.17`, `@convex-dev/better-auth@0.12.4`, Next.js 16 (App Router), React, react-hook-form + Zod, shadcn `Form`/`InputOTP`, React Email, `next-intl`, Vitest 4 + convex-test, Bun, Turborepo, `qrcode`.

## Global Constraints

Copied verbatim from the spec and project rules. Every task's requirements implicitly include these.

- **No em dashes** in any UI copy, comment, commit message, or doc. Use a period, comma, colon, or parentheses.
- **All user-facing text goes through i18n.** New strings go to `packages/i18n/messages/en.json` first (English is the base; `Messages = typeof en`), then mirrored to `sv.json`, `nb.json`, `da.json`, `fi.json`. The parity test fails if any locale's key set differs from en. Non-English are machine drafts: flag for native review.
- **Locales:** `["en", "sv", "nb", "da", "fi"]`, default `en` (`packages/i18n/src/routing.ts`).
- **Non-ASCII** (å ä ö æ ø): write literal UTF-8 directly via the editor. Never via shell `perl`/`sed` (double-encodes).
- **Tests run with Vitest 4** via `bun run test` (never `bun test`). New code ships with tests in the same commit. The pre-commit hook runs Biome (staged) + full typecheck + full `turbo run test`; all three must pass. Never `--no-verify`.
- **shadcn vendor code** (`packages/ui/src/{components,hooks,lib,styles}`) is not reformatted or relinted; reuse it as-is.
- **AI never touches this path; no personal data leaves the app to any AI.** (No AI is involved in 2FA.)
- **EU only** (Convex eu-west-1). Unchanged.
- **Forms:** `useForm({ resolver: zodResolver(schema), mode: "onTouched" })`, schema factories `makeXSchema(t)` with `t = useTranslations("dashboard.validation")`, render with `FormField`/`FormItem`/`FormControl`/`FormMessage`, submit gated on `isValid` (+ `isSubmitting`).
- **Internal navigation uses the Link component, never `<a>`.**
- **Commits:** Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`), lowercase imperative summary, no AI attribution, no `Co-Authored-By`.
- **Leave work uncommitted is NOT in force here:** this plan commits per task (the project allows focused single-concern commits on `main` once work is approved; do not push).
- **Brand color** `#eb3e5d` (`colors.brand` in `packages/email/src/components/theme.tsx`); brand is never used on a judgement value (a verification code is not a judgement value, but keep the code panel neutral to match the polyform reference).

### Design decisions carried from the spec (read before starting)

- **Method model:** the user picks one method at setup (authenticator recommended, or email). Email codes are always available as a recovery channel for authenticator users. No backup-code sheet.
- **`skipVerificationOnEnable: true`** is required so an email-method user can finish enrollment without ever owning an authenticator (Better Auth's enable flow is otherwise TOTP-centric). Consequence: `user.twoFactorEnabled` becomes true at `enable()`, before the method is confirmed, so the gate keys on our `mfaConfirmedAt`, not on `twoFactorEnabled`.
- **Re-authentication before enabling 2FA:** the setup flow re-confirms the user's password at the `enable()` step (OWASP/NIST: factor enrollment is high-risk, must not rely on session alone). The password is passed straight to `enable()` and never retained in React state across steps.
- **No device trust** (`trustDevice` is never passed): the second factor is required on every sign-in.
- **Audit (deviation from the spec, see Task 4):** the spec proposed an `mfa.enabled` org-scoped audit event. This plan does NOT add one in V1. MFA is per-user account-security state, not org-domain state; the org-scoped audit log is chartered for org domain changes, and a per-user MFA method in a tenant log is a poor fit (which org for a multi-org user?) and edges toward person-data. The record of MFA state is `mfaConfirmedAt` on the `users` mirror plus Better Auth's `twoFactor` table. Revisit if a dedicated account-security audit surface is added. **If the reviewer wants the audit event, it is a small add (Task 4 notes how).**

---

## File Structure

**Backend (`packages/backend/convex/`):**
- Modify `auth.ts` — add `twoFactor(...)` to the plugins array, `sendOTP`, and rate-limit rules.
- Regenerate `betterAuth/generatedSchema.ts` — adds the `twoFactor` table + `user.twoFactorEnabled`.
- Modify `betterAuth/provisioning.ts` — add `hasTwoFactorEnabled` query.
- Modify `betterAuth/testing.ts` — add `seedUserWithTwoFactor` test helper.
- Modify `accounts/tables.ts` — add `mfaMethod` + `mfaConfirmedAt` to the `users` mirror.
- Modify `lib/functions.ts` — add `authedQuery` + `authedMutation` (authenticated, not org-scoped).
- Create `accounts/twoFactor.ts` — `getMyMfaStatus` query + `confirmMfaSetup` mutation.
- Create `accounts/twoFactor.test.ts` — backend tests.

**Email (`packages/email/`, `packages/constants/`):**
- Modify `packages/constants/src/email.ts` — add `"twoFactorCode"` template key.
- Create `packages/email/src/templates/two-factor-code.tsx` — the code email.
- Modify `packages/email/src/render.ts` — wire the new template into `EmailProps` + `renderEmail`.
- Modify `packages/email/src/render.test.ts` — render tests for the new template.

**Dashboard app (`apps/dashboard/`):**
- Modify `app/(app)/layout.tsx` — insert `TwoFactorGate` above `OnboardingGate`.
- Create `components/auth/two-factor-gate.tsx` — the enrollment gate.
- Create `components/auth/two-factor-setup.tsx` — the setup wizard (method choice, confirm password, TOTP/QR or email confirm).
- Create `components/auth/two-factor-challenge.tsx` — the sign-in second-factor screen.
- Modify `components/auth/sign-in-screen.tsx` — branch to the challenge on `twoFactorRedirect`.
- Modify `lib/auth-client.ts` — add `twoFactorClient()`.
- Create `lib/two-factor-schemas.ts` — Zod factories for the setup/challenge code + password fields.
- Tests: `components/auth/two-factor-gate.test.tsx`, `two-factor-setup.test.tsx`, `two-factor-challenge.test.tsx`.

**i18n (`packages/i18n/messages/`):**
- Modify all five of `en.json`, `sv.json`, `nb.json`, `da.json`, `fi.json` — add `email.twoFactorCode.*`, `dashboard.help.twoFactor*`, `dashboard.auth.twoFactor.*`, `dashboard.twoFactorSetup.*`.

---

## Task 1: i18n strings for 2FA (all five locales)

Adds every new key up front so later tasks compile and the parity test stays green. English is authoritative; the Nordic strings are drafts (flag for native review).

**Files:**
- Modify: `packages/i18n/messages/en.json`
- Modify: `packages/i18n/messages/sv.json`
- Modify: `packages/i18n/messages/nb.json`
- Modify: `packages/i18n/messages/da.json`
- Modify: `packages/i18n/messages/fi.json`
- Test: `packages/i18n` parity test (`bun run --filter @workspace/i18n test`)

**Interfaces:**
- Produces (consumed by Tasks 2, 6, 7): `email.twoFactorCode.{subject,heading,body,note}`; `dashboard.help.{twoFactorLabel,twoFactorBody}`; `dashboard.auth.twoFactor.{title,totpPrompt,emailPrompt,codeLabel,cta,useEmail,useAuthenticator,resend,error}`; `dashboard.twoFactorSetup.*` (see block below).

- [ ] **Step 1: Add keys to `en.json`**

In the `email` object (sibling to `welcome`), add:
```json
"twoFactorCode": {
  "subject": "Your blueprnt verification code",
  "heading": "Verify it's you",
  "body": "Enter this code to finish signing in to blueprnt:",
  "note": "This code expires shortly. If you didn't try to sign in, you can ignore this email and your account stays secure."
}
```

In `dashboard.help`, add:
```json
"twoFactorLabel": "What is two-step verification?",
"twoFactorBody": "Two-step verification adds a second check when you sign in, on top of your password: a code from an authenticator app or sent to your email. A stolen password alone then can't open your account. It is required for everyone on blueprnt."
```

In `dashboard.auth`, add a `twoFactor` object:
```json
"twoFactor": {
  "title": "Verify it's you",
  "totpPrompt": "Enter the 6-digit code from your authenticator app.",
  "emailPrompt": "We sent a 6-digit code to your email. Enter it below.",
  "codeLabel": "6-digit code",
  "cta": "Verify",
  "useEmail": "Email me a code instead",
  "useAuthenticator": "Use your authenticator app instead",
  "resend": "Didn't receive it? Resend",
  "error": "That code didn't work. Try again."
}
```

In `dashboard` (a new sibling object to `auth`, `help`, `onboarding`), add:
```json
"twoFactorSetup": {
  "heading": "Secure your account",
  "intro": "Two-step verification is required. Choose how you'll confirm it's you when you sign in.",
  "methodTotp": { "label": "Authenticator app", "description": "Use an app like Google Authenticator or 1Password. Recommended." },
  "methodEmail": { "label": "Email codes", "description": "We email you a code each time you sign in." },
  "continue": "Continue",
  "password": { "heading": "Confirm your password", "description": "Re-enter your password to turn on two-step verification.", "label": "Password", "cta": "Turn on", "error": "That password is incorrect. Try again." },
  "totp": { "heading": "Scan the QR code", "description": "Scan this with your authenticator app, then enter the 6-digit code it shows.", "manualKey": "Can't scan? Enter this key manually:", "qrAlt": "QR code for your authenticator app" },
  "email": { "heading": "Check your email", "description": "We sent a 6-digit code to {email}. Enter it below.", "resend": "Resend code", "resent": "A new code is on its way." },
  "codeLabel": "6-digit code",
  "verify": "Verify",
  "verifyError": "That code didn't work. Try again.",
  "changeMethod": "Choose a different method"
}
```

- [ ] **Step 2: Mirror the same keys into `sv.json`** (Swedish draft)

`email.twoFactorCode`:
```json
"twoFactorCode": {
  "subject": "Din verifieringskod för blueprnt",
  "heading": "Verifiera att det är du",
  "body": "Ange den här koden för att slutföra inloggningen på blueprnt:",
  "note": "Koden upphör snart. Om du inte försökte logga in kan du ignorera detta mejl och ditt konto förblir säkert."
}
```
`dashboard.help`:
```json
"twoFactorLabel": "Vad är tvåstegsverifiering?",
"twoFactorBody": "Tvåstegsverifiering lägger till en andra kontroll vid inloggning, utöver ditt lösenord: en kod från en autentiseringsapp eller skickad till din e-post. Ett stulet lösenord ensamt kan då inte öppna ditt konto. Det krävs för alla på blueprnt."
```
`dashboard.auth.twoFactor`:
```json
"twoFactor": {
  "title": "Verifiera att det är du",
  "totpPrompt": "Ange den 6-siffriga koden från din autentiseringsapp.",
  "emailPrompt": "Vi har skickat en 6-siffrig kod till din e-post. Ange den nedan.",
  "codeLabel": "6-siffrig kod",
  "cta": "Verifiera",
  "useEmail": "Skicka en kod till min e-post i stället",
  "useAuthenticator": "Använd din autentiseringsapp i stället",
  "resend": "Fick du ingen kod? Skicka igen",
  "error": "Koden fungerade inte. Försök igen."
}
```
`dashboard.twoFactorSetup`:
```json
"twoFactorSetup": {
  "heading": "Säkra ditt konto",
  "intro": "Tvåstegsverifiering krävs. Välj hur du vill bekräfta att det är du när du loggar in.",
  "methodTotp": { "label": "Autentiseringsapp", "description": "Använd en app som Google Authenticator eller 1Password. Rekommenderas." },
  "methodEmail": { "label": "E-postkoder", "description": "Vi mejlar dig en kod varje gång du loggar in." },
  "continue": "Fortsätt",
  "password": { "heading": "Bekräfta ditt lösenord", "description": "Ange ditt lösenord igen för att aktivera tvåstegsverifiering.", "label": "Lösenord", "cta": "Aktivera", "error": "Lösenordet är felaktigt. Försök igen." },
  "totp": { "heading": "Skanna QR-koden", "description": "Skanna den med din autentiseringsapp och ange sedan den 6-siffriga koden som visas.", "manualKey": "Kan du inte skanna? Ange den här nyckeln manuellt:", "qrAlt": "QR-kod för din autentiseringsapp" },
  "email": { "heading": "Kolla din e-post", "description": "Vi har skickat en 6-siffrig kod till {email}. Ange den nedan.", "resend": "Skicka koden igen", "resent": "En ny kod är på väg." },
  "codeLabel": "6-siffrig kod",
  "verify": "Verifiera",
  "verifyError": "Koden fungerade inte. Försök igen.",
  "changeMethod": "Välj en annan metod"
}
```

- [ ] **Step 3: Mirror into `nb.json`** (Norwegian Bokmål draft)

```json
"twoFactorCode": {
  "subject": "Din verifiseringskode for blueprnt",
  "heading": "Bekreft at det er deg",
  "body": "Skriv inn denne koden for å fullføre innloggingen på blueprnt:",
  "note": "Koden utløper snart. Hvis du ikke prøvde å logge inn, kan du ignorere denne e-posten, og kontoen din forblir sikker."
}
```
```json
"twoFactorLabel": "Hva er tostegsbekreftelse?",
"twoFactorBody": "Tostegsbekreftelse legger til en ekstra kontroll når du logger inn, i tillegg til passordet: en kode fra en autentiseringsapp eller sendt til e-posten din. Et stjålet passord alene kan da ikke åpne kontoen din. Det kreves for alle på blueprnt."
```
```json
"twoFactor": {
  "title": "Bekreft at det er deg",
  "totpPrompt": "Skriv inn den 6-sifrede koden fra autentiseringsappen.",
  "emailPrompt": "Vi sendte en 6-sifret kode til e-posten din. Skriv den inn nedenfor.",
  "codeLabel": "6-sifret kode",
  "cta": "Bekreft",
  "useEmail": "Send meg en kode på e-post i stedet",
  "useAuthenticator": "Bruk autentiseringsappen i stedet",
  "resend": "Fikk du ingen kode? Send på nytt",
  "error": "Koden fungerte ikke. Prøv igjen."
}
```
```json
"twoFactorSetup": {
  "heading": "Sikre kontoen din",
  "intro": "Tostegsbekreftelse er påkrevd. Velg hvordan du vil bekrefte at det er deg når du logger inn.",
  "methodTotp": { "label": "Autentiseringsapp", "description": "Bruk en app som Google Authenticator eller 1Password. Anbefales." },
  "methodEmail": { "label": "E-postkoder", "description": "Vi sender deg en kode på e-post hver gang du logger inn." },
  "continue": "Fortsett",
  "password": { "heading": "Bekreft passordet ditt", "description": "Skriv inn passordet ditt på nytt for å slå på tostegsbekreftelse.", "label": "Passord", "cta": "Slå på", "error": "Passordet er feil. Prøv igjen." },
  "totp": { "heading": "Skann QR-koden", "description": "Skann den med autentiseringsappen, og skriv deretter inn den 6-sifrede koden som vises.", "manualKey": "Kan du ikke skanne? Skriv inn denne nøkkelen manuelt:", "qrAlt": "QR-kode for autentiseringsappen" },
  "email": { "heading": "Sjekk e-posten din", "description": "Vi sendte en 6-sifret kode til {email}. Skriv den inn nedenfor.", "resend": "Send koden på nytt", "resent": "En ny kode er på vei." },
  "codeLabel": "6-sifret kode",
  "verify": "Bekreft",
  "verifyError": "Koden fungerte ikke. Prøv igjen.",
  "changeMethod": "Velg en annen metode"
}
```

- [ ] **Step 4: Mirror into `da.json`** (Danish draft)

```json
"twoFactorCode": {
  "subject": "Din verifikationskode til blueprnt",
  "heading": "Bekræft, at det er dig",
  "body": "Indtast denne kode for at fuldføre login på blueprnt:",
  "note": "Koden udløber snart. Hvis du ikke forsøgte at logge ind, kan du ignorere denne e-mail, og din konto forbliver sikker."
}
```
```json
"twoFactorLabel": "Hvad er totrinsbekræftelse?",
"twoFactorBody": "Totrinsbekræftelse tilføjer et ekstra tjek, når du logger ind, ud over din adgangskode: en kode fra en godkendelsesapp eller sendt til din e-mail. En stjålet adgangskode alene kan så ikke åbne din konto. Det kræves for alle på blueprnt."
```
```json
"twoFactor": {
  "title": "Bekræft, at det er dig",
  "totpPrompt": "Indtast den 6-cifrede kode fra din godkendelsesapp.",
  "emailPrompt": "Vi sendte en 6-cifret kode til din e-mail. Indtast den nedenfor.",
  "codeLabel": "6-cifret kode",
  "cta": "Bekræft",
  "useEmail": "Send mig en kode på e-mail i stedet",
  "useAuthenticator": "Brug din godkendelsesapp i stedet",
  "resend": "Fik du ingen kode? Send igen",
  "error": "Koden virkede ikke. Prøv igen."
}
```
```json
"twoFactorSetup": {
  "heading": "Sikr din konto",
  "intro": "Totrinsbekræftelse er påkrævet. Vælg, hvordan du vil bekræfte, at det er dig, når du logger ind.",
  "methodTotp": { "label": "Godkendelsesapp", "description": "Brug en app som Google Authenticator eller 1Password. Anbefales." },
  "methodEmail": { "label": "E-mailkoder", "description": "Vi sender dig en kode på e-mail, hver gang du logger ind." },
  "continue": "Fortsæt",
  "password": { "heading": "Bekræft din adgangskode", "description": "Indtast din adgangskode igen for at slå totrinsbekræftelse til.", "label": "Adgangskode", "cta": "Slå til", "error": "Adgangskoden er forkert. Prøv igen." },
  "totp": { "heading": "Scan QR-koden", "description": "Scan den med din godkendelsesapp, og indtast derefter den 6-cifrede kode, den viser.", "manualKey": "Kan du ikke scanne? Indtast denne nøgle manuelt:", "qrAlt": "QR-kode til din godkendelsesapp" },
  "email": { "heading": "Tjek din e-mail", "description": "Vi sendte en 6-cifret kode til {email}. Indtast den nedenfor.", "resend": "Send koden igen", "resent": "En ny kode er på vej." },
  "codeLabel": "6-cifret kode",
  "verify": "Bekræft",
  "verifyError": "Koden virkede ikke. Prøv igen.",
  "changeMethod": "Vælg en anden metode"
}
```

- [ ] **Step 5: Mirror into `fi.json`** (Finnish draft)

```json
"twoFactorCode": {
  "subject": "blueprnt-vahvistuskoodisi",
  "heading": "Vahvista henkilöllisyytesi",
  "body": "Anna tämä koodi viimeistelläksesi kirjautumisen blueprntiin:",
  "note": "Koodi vanhenee pian. Jos et yrittänyt kirjautua sisään, voit jättää tämän viestin huomiotta, ja tilisi pysyy turvassa."
}
```
```json
"twoFactorLabel": "Mitä kaksivaiheinen vahvistus tarkoittaa?",
"twoFactorBody": "Kaksivaiheinen vahvistus lisää kirjautumiseen toisen tarkistuksen salasanan lisäksi: koodin todennussovelluksesta tai sähköpostiisi lähetettynä. Varastettu salasana yksin ei silloin avaa tiliäsi. Se vaaditaan kaikilta blueprntissä."
```
```json
"twoFactor": {
  "title": "Vahvista henkilöllisyytesi",
  "totpPrompt": "Anna 6-numeroinen koodi todennussovelluksestasi.",
  "emailPrompt": "Lähetimme 6-numeroisen koodin sähköpostiisi. Anna se alla.",
  "codeLabel": "6-numeroinen koodi",
  "cta": "Vahvista",
  "useEmail": "Lähetä koodi sähköpostiini sen sijaan",
  "useAuthenticator": "Käytä todennussovellusta sen sijaan",
  "resend": "Etkö saanut koodia? Lähetä uudelleen",
  "error": "Koodi ei toiminut. Yritä uudelleen."
}
```
```json
"twoFactorSetup": {
  "heading": "Suojaa tilisi",
  "intro": "Kaksivaiheinen vahvistus vaaditaan. Valitse, miten vahvistat henkilöllisyytesi kirjautuessasi.",
  "methodTotp": { "label": "Todennussovellus", "description": "Käytä sovellusta kuten Google Authenticator tai 1Password. Suositeltu." },
  "methodEmail": { "label": "Sähköpostikoodit", "description": "Lähetämme sinulle koodin sähköpostitse joka kerta, kun kirjaudut sisään." },
  "continue": "Jatka",
  "password": { "heading": "Vahvista salasanasi", "description": "Anna salasanasi uudelleen ottaaksesi kaksivaiheisen vahvistuksen käyttöön.", "label": "Salasana", "cta": "Ota käyttöön", "error": "Salasana on virheellinen. Yritä uudelleen." },
  "totp": { "heading": "Skannaa QR-koodi", "description": "Skannaa se todennussovelluksellasi ja anna sitten sen näyttämä 6-numeroinen koodi.", "manualKey": "Etkö voi skannata? Anna tämä avain manuaalisesti:", "qrAlt": "Todennussovelluksen QR-koodi" },
  "email": { "heading": "Tarkista sähköpostisi", "description": "Lähetimme 6-numeroisen koodin osoitteeseen {email}. Anna se alla.", "resend": "Lähetä koodi uudelleen", "resent": "Uusi koodi on tulossa." },
  "codeLabel": "6-numeroinen koodi",
  "verify": "Vahvista",
  "verifyError": "Koodi ei toiminut. Yritä uudelleen.",
  "changeMethod": "Valitse toinen tapa"
}
```

- [ ] **Step 6: Run the parity test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter @workspace/i18n test`
Expected: PASS. If a locale fails with a key-set diff, the missing/extra key path is named; fix that file. (`Messages = typeof en`, so a typo in en.json surfaces as a type error in later tasks instead.)

- [ ] **Step 7: Commit**

```bash
cd /Volumes/development/blueprnt/frontend
git add packages/i18n/messages
git commit -m "i18n: add two-factor authentication strings (en + nordic drafts)"
```

---

## Task 2: `twoFactorCode` email template

The code email, copying the polyform look (a centered, boxed monospace 6-digit code) on our `BaseEmailTemplate`.

**Files:**
- Modify: `packages/constants/src/email.ts`
- Create: `packages/email/src/templates/two-factor-code.tsx`
- Modify: `packages/email/src/render.ts`
- Test: `packages/email/src/render.test.ts`

**Interfaces:**
- Consumes (Task 1): `email.twoFactorCode.{subject,heading,body,note}`.
- Produces (Task 3): template key `"twoFactorCode"` with props `{ code: string; email: string; locale: string }` (`EmailProps["twoFactorCode"]`).

- [ ] **Step 1: Add the failing render test**

In `packages/email/src/render.test.ts`, add inside the existing `describe("renderEmail", ...)`:
```typescript
it("renders the two-factor code email with the code and branded layout", async () => {
  const result = await renderEmail("twoFactorCode", {
    code: "123456",
    email: "user@example.com",
    locale: "en",
  })
  expect(result.subject).toBe("Your blueprnt verification code")
  expect(result.html).toContain("123456")
  expect(result.html).toContain("/email/blueprnt-wordmark.png")
  expect(result.text).toContain("123456")
})

it("renders the two-factor code email in Swedish", async () => {
  const result = await renderEmail("twoFactorCode", {
    code: "654321",
    email: "user@example.com",
    locale: "sv",
  })
  expect(result.subject).not.toBe("Your blueprnt verification code")
  expect(result.html).toContain("654321")
})
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter @workspace/email test`
Expected: FAIL. TypeScript/runtime error that `"twoFactorCode"` is not assignable to `EmailTemplateKey` (and the template does not exist yet).

- [ ] **Step 3: Add the template key to constants**

In `packages/constants/src/email.ts`, extend the tuple:
```typescript
export const EMAIL_TEMPLATE_KEYS = [
  "invitation",
  "resetPassword",
  "welcome",
  "twoFactorCode",
] as const
```

- [ ] **Step 4: Create the template file**

Create `packages/email/src/templates/two-factor-code.tsx`:
```tsx
import { Section, Text } from "@react-email/components"
import { BaseEmailTemplate } from "../components/base-email"
import { colors } from "../components/theme"
import { emailMessages } from "../messages"

export interface TwoFactorCodeEmailProps {
  code: string
  email: string
  locale: string
}

export function TwoFactorCodeEmail({ code, locale }: TwoFactorCodeEmailProps) {
  const m = emailMessages(locale).twoFactorCode
  return (
    <BaseEmailTemplate preview={m.heading} title={m.heading} locale={locale}>
      <Text
        className="m-0 text-[16px] leading-[26px]"
        style={{ color: colors.text }}
      >
        {m.body}
      </Text>
      <Section className="my-[32px] text-center">
        <Text
          className="m-0 inline-block rounded-[8px] bg-[#f5f5f5] px-[28px] py-[18px] text-center font-mono text-[30px] font-bold tracking-[8px]"
          style={{ color: colors.text }}
        >
          {code}
        </Text>
      </Section>
      <Text
        className="m-0 text-[14px] leading-[22px]"
        style={{ color: colors.muted }}
      >
        {m.note}
      </Text>
    </BaseEmailTemplate>
  )
}

TwoFactorCodeEmail.PreviewProps = {
  code: "123456",
  email: "user@example.com",
  locale: "en",
} satisfies TwoFactorCodeEmailProps

export default TwoFactorCodeEmail
```
Note: `email` is part of the props (the caller passes the recipient) but is not rendered in the body, keeping the message generic. The subject deliberately omits the code (codes in subject lines leak via lock-screen/preview notifications).

- [ ] **Step 5: Wire the template into `render.ts`**

In `packages/email/src/render.ts`, add the import (after the `WelcomeEmail` import):
```typescript
import {
  TwoFactorCodeEmail,
  type TwoFactorCodeEmailProps,
} from "./templates/two-factor-code"
```
Extend `EmailProps`:
```typescript
export type EmailProps = {
  invitation: InvitationEmailProps
  resetPassword: LinkEmailProps
  welcome: LinkEmailProps
  twoFactorCode: TwoFactorCodeEmailProps
}
```
Add a `case` before the `default` in the `switch`:
```typescript
    case "twoFactorCode": {
      const p = props as TwoFactorCodeEmailProps
      const element = TwoFactorCodeEmail(p)
      return {
        subject: m.twoFactorCode.subject,
        html: await render(element),
        text: await render(element, { plainText: true }),
      }
    }
```

- [ ] **Step 6: Run the test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter @workspace/email test`
Expected: PASS (all existing tests plus the two new ones).

- [ ] **Step 7: Commit**

```bash
cd /Volumes/development/blueprnt/frontend
git add packages/constants/src/email.ts packages/email/src/templates/two-factor-code.tsx packages/email/src/render.ts packages/email/src/render.test.ts
git commit -m "feat(email): add two-factor verification code template"
```

---

## Task 3: Enable the `twoFactor` plugin, regenerate schema, wire OTP delivery and rate limits

Config + schema task. Verified by typecheck and an inspected schema diff (the better-auth adapter path does not run under convex-test, so there is no unit test for the wiring itself).

**Files:**
- Modify: `packages/backend/convex/auth.ts`
- Modify: `apps/dashboard/lib/auth-client.ts`
- Regenerate: `packages/backend/convex/betterAuth/generatedSchema.ts`

**Interfaces:**
- Consumes (Task 2): template key `"twoFactorCode"` + props `{ code, email, locale }`.
- Produces (Tasks 4, 6, 7): `user.twoFactorEnabled` + `twoFactor` table in the component schema; `authClient.twoFactor.{enable,verifyTotp,sendOtp,verifyOtp}` on the client; `signIn.email` returning `twoFactorRedirect` when 2FA is enabled.

- [ ] **Step 1: Add the server plugin to `auth.ts`**

Add the import alongside the other plugin imports near the top of `packages/backend/convex/auth.ts`:
```typescript
import { organization, twoFactor } from "better-auth/plugins"
```
(If `organization` is currently imported on its own line, merge them or keep two import lines; match the existing style.)

In the `plugins` array, insert `twoFactor(...)` between `organization(...)` and `convex({ authConfig })`:
```typescript
      twoFactor({
        issuer: "blueprnt",
        // Required so an email-method user can complete enrollment without ever
        // owning an authenticator: Better Auth's enable flow is otherwise
        // TOTP-verification-centric. Consequence: user.twoFactorEnabled flips
        // true at enable(), before the method is confirmed, so the app gate
        // keys on our own users.mfaConfirmedAt marker, not on twoFactorEnabled.
        skipVerificationOnEnable: true,
        otpOptions: {
          sendOTP: async ({ user, otp }) => {
            const mctx = requireRunMutationCtx(ctx)
            // Resolve the recipient's stored language so the code email goes out
            // in their locale, mirroring sendResetPassword. Falls back to en.
            const settings = await mctx.runQuery(
              internal.accounts.organization.getLanguageForUser,
              { userId: user.id }
            )
            await mctx.runMutation(internal.email.outbox.enqueueEmail, {
              to: user.email,
              templateKey: "twoFactorCode",
              props: { code: otp, email: user.email },
              locale: settings?.language ?? "en",
            })
          },
        },
      }),
```
Verification note: confirm the `sendOTP` argument shape against the installed types. Per the Better Auth 1.6.17 docs it is `({ user, otp }, request)`; if the installed types differ (for example `{ email, code }`), the typecheck in Step 4 will flag it. Adjust `user.id`/`user.email`/`otp` to the actual field names. `enqueueEmail`'s `props` is type-checked against `EmailProps["twoFactorCode"]` = `{ code, email, locale }` (locale is added by `deliver`), so a wrong prop shape is a compile error.

- [ ] **Step 2: Add the rate-limit rules in `auth.ts`**

In the `rateLimit.customRules` object, add the three 2FA endpoints after `"/sign-in/email"`:
```typescript
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/send-otp": { window: 60, max: 3 },
        "/two-factor/verify-otp": { window: 60, max: 5 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
```
(Better Auth's twoFactor plugin also enforces `failedVerificationCount`/`lockedUntil` per the `twoFactor` table; these custom rules add an IP/route throttle on top.)

- [ ] **Step 3: Add the client plugin in `auth-client.ts`**

In `apps/dashboard/lib/auth-client.ts`, add the import:
```typescript
import {
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins"
```
And add `twoFactorClient()` to the plugins array (order: organization, twoFactor, convex):
```typescript
export const authClient = createAuthClient({
  plugins: [
    organizationClient({ ac, roles: { admin, editor } }),
    twoFactorClient(),
    convexClient(),
  ],
})
```

- [ ] **Step 4: Regenerate the component schema**

The plugin must be present in the auth config first (Steps 1-2), then regenerate so the generator emits the `twoFactor` table and `user.twoFactorEnabled`. Run the command from the header of `generatedSchema.ts`:
```bash
cd /Volumes/development/blueprnt/frontend/packages/backend/convex/betterAuth
npx auth generate --output generatedSchema.ts
```
(Open `generatedSchema.ts` first and use the exact command quoted in its header comment if it differs.)

- [ ] **Step 5: Verify the schema diff**

Run:
```bash
cd /Volumes/development/blueprnt/frontend
git diff packages/backend/convex/betterAuth/generatedSchema.ts | grep -E "twoFactor|twoFactorEnabled"
```
Expected: the diff adds a `twoFactor: defineTable({...})` (with `userId`, `secret`, `backupCodes`, and a `userId` index) and `twoFactorEnabled: v.optional(v.boolean())` on the `user` table. If nothing appears, the plugin was not picked up: confirm Step 1 saved and re-run Step 4.

- [ ] **Step 6: Typecheck the workspace**

Run: `cd /Volumes/development/blueprnt/frontend && bun run turbo typecheck`
Expected: PASS. Fix any `sendOTP` field-name mismatch flagged here (see Step 1 note).

- [ ] **Step 7: Run the full test suite (no regressions)**

Run: `cd /Volumes/development/blueprnt/frontend && bun run test`
Expected: PASS (existing tests unaffected).

- [ ] **Step 8: Commit**

```bash
cd /Volumes/development/blueprnt/frontend
git add packages/backend/convex/auth.ts apps/dashboard/lib/auth-client.ts packages/backend/convex/betterAuth/generatedSchema.ts
git commit -m "feat(auth): enable two-factor plugin with email OTP delivery and rate limits"
```

---

## Task 4: MFA state, status query, and confirm mutation

Adds the `users` mirror fields, the authenticated (non-org) function wrappers, a component query to read `twoFactorEnabled`, and the two app functions the gate uses. Fully TDD with convex-test.

**Files:**
- Modify: `packages/backend/convex/accounts/tables.ts`
- Modify: `packages/backend/convex/lib/functions.ts`
- Modify: `packages/backend/convex/betterAuth/provisioning.ts`
- Modify: `packages/backend/convex/betterAuth/testing.ts`
- Create: `packages/backend/convex/accounts/twoFactor.ts`
- Test: `packages/backend/convex/accounts/twoFactor.test.ts`

**Interfaces:**
- Consumes (Task 3): `user.twoFactorEnabled` in the component schema.
- Produces (Tasks 5, 6): `api.accounts.twoFactor.getMyMfaStatus` query → `{ confirmed: boolean; method: "totp" | "email" | null }`; `api.accounts.twoFactor.confirmMfaSetup` mutation, args `{ method: "totp" | "email" }`, returns `null`.

- [ ] **Step 1: Add the mirror fields**

In `packages/backend/convex/accounts/tables.ts`, add to the `users` table definition (before the `.index(...)` chain):
```typescript
export const users = defineTable({
  authId: v.string(),
  name: v.string(),
  email: v.string(),
  locale: v.optional(v.string()),
  isPlatformAdmin: v.optional(v.boolean()),
  // Account-level 2FA state (per-person, independent of any org). The method
  // the user chose; mfaConfirmedAt is the authoritative "setup complete" signal
  // (Better Auth's twoFactorEnabled flips early under skipVerificationOnEnable).
  // Removed with the rest of the mirror row on GDPR erasure.
  mfaMethod: v.optional(v.union(v.literal("totp"), v.literal("email"))),
  mfaConfirmedAt: v.optional(v.number()),
})
  .index("by_auth_id", ["authId"])
  .index("by_email", ["email"])
```

- [ ] **Step 2: Add `authedQuery` / `authedMutation` to `functions.ts`**

In `packages/backend/convex/lib/functions.ts`, after `requirePlatformAdmin` / the platform builders, add:
```typescript
// Authenticated but NOT org-scoped: injects ctx.authUserId from the JWT
// subject. For per-user account state (e.g. 2FA) that is independent of any
// organization. Mirrors requirePlatformAdmin minus the platform-admin check.
async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (identity === null) throw appError(ERROR_CODES.notAuthenticated)
  return identity.subject
}

export const authedQuery = customQuery(query, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requireAuth(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})

export const authedMutation = customMutation(mutation, {
  args: {},
  input: async (ctx) => {
    const authUserId = await requireAuth(ctx)
    return { ctx: { authUserId }, args: {} }
  },
})
```

- [ ] **Step 3: Add `hasTwoFactorEnabled` to the component's `provisioning.ts`**

In `packages/backend/convex/betterAuth/provisioning.ts`, after `hasPassword`, add:
```typescript
// True iff Better Auth has two-factor enabled for the user. With
// skipVerificationOnEnable, twoFactorEnabled is set at enable() (which is
// password-gated), so this is the security backstop the app uses before
// stamping its own mfaConfirmedAt marker.
export const hasTwoFactorEnabled = query({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { userId }) => {
    const id = ctx.db.normalizeId("user", userId)
    if (id === null) return false
    const user = await ctx.db.get(id)
    return user?.twoFactorEnabled === true
  },
})
```

- [ ] **Step 4: Add the `seedUserWithTwoFactor` test helper to the component's `testing.ts`**

In `packages/backend/convex/betterAuth/testing.ts`, add a seed mutation alongside `seedMembership` (match its import style; it uses the component's `mutation` from `./_generated/server`):
```typescript
// Test-only: provision a user with two-factor already enabled, so app-side
// tests can exercise the confirm path. Mirrors seedMembership's shape.
export const seedUserWithTwoFactor = mutation({
  args: { email: v.string(), name: v.string() },
  returns: v.object({ userId: v.string() }),
  handler: async (ctx, { email, name }) => {
    const now = Date.now()
    const id = await ctx.db.insert("user", {
      email: email.trim().toLowerCase(),
      name,
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: now,
      updatedAt: now,
    })
    return { userId: id.toString() }
  },
})
```
(Ensure `v` is imported in that file: `import { v } from "convex/values"`.)

- [ ] **Step 5: Write the failing tests**

Create `packages/backend/convex/accounts/twoFactor.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { api, components } from "../_generated/api"
import { initConvexTest } from "../testing.helpers"

describe("accounts.twoFactor.getMyMfaStatus", () => {
  it("reports unconfirmed for a user with no mirror row", async () => {
    const t = initConvexTest()
    const status = await t
      .withIdentity({ subject: "user-1" })
      .query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status).toEqual({ confirmed: false, method: null })
  })

  it("reports confirmed and the method once mfaConfirmedAt is set", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "HR Person",
        email: "hr@acme.se",
        mfaMethod: "totp",
        mfaConfirmedAt: 1_700_000_000_000,
      })
    })
    const status = await t
      .withIdentity({ subject: "user-1" })
      .query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status).toEqual({ confirmed: true, method: "totp" })
  })

  it("throws when unauthenticated", async () => {
    const t = initConvexTest()
    await expect(
      t.query(api.accounts.twoFactor.getMyMfaStatus, {})
    ).rejects.toThrow()
  })
})

describe("accounts.twoFactor.confirmMfaSetup", () => {
  it("rejects when Better Auth has not enabled 2FA for the user", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: "user-1",
        name: "HR Person",
        email: "hr@acme.se",
      })
    })
    await expect(
      t
        .withIdentity({ subject: "user-1" })
        .mutation(api.accounts.twoFactor.confirmMfaSetup, { method: "email" })
    ).rejects.toThrow()
  })

  it("stamps the mirror once 2FA is genuinely enabled", async () => {
    const t = initConvexTest()
    const { userId } = await t.mutation(
      components.betterAuth.testing.seedUserWithTwoFactor,
      { email: "hr@acme.se", name: "HR Person" }
    )
    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        authId: userId,
        name: "HR Person",
        email: "hr@acme.se",
      })
    })
    await t
      .withIdentity({ subject: userId })
      .mutation(api.accounts.twoFactor.confirmMfaSetup, { method: "totp" })

    const status = await t
      .withIdentity({ subject: userId })
      .query(api.accounts.twoFactor.getMyMfaStatus, {})
    expect(status.confirmed).toBe(true)
    expect(status.method).toBe("totp")
  })
})
```

- [ ] **Step 6: Run the tests, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter @workspace/backend test -- twoFactor`
Expected: FAIL (`api.accounts.twoFactor` does not exist yet).

- [ ] **Step 7: Implement `accounts/twoFactor.ts`**

Create `packages/backend/convex/accounts/twoFactor.ts`:
```typescript
import { v } from "convex/values"
import { components } from "../_generated/api"
import { appError, ERROR_CODES } from "../lib/errors"
import { authedMutation, authedQuery } from "../lib/functions"

// The caller's account-level 2FA state. confirmed (mfaConfirmedAt set) is the
// app's authoritative "setup complete" signal; the gate keys on it.
export const getMyMfaStatus = authedQuery({
  args: {},
  returns: v.object({
    confirmed: v.boolean(),
    method: v.union(v.literal("totp"), v.literal("email"), v.null()),
  }),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", ctx.authUserId))
      .unique()
    return {
      confirmed: row?.mfaConfirmedAt != null,
      method: row?.mfaMethod ?? null,
    }
  },
})

// Records that the caller finished 2FA setup with the given method. Backstop:
// only stamp if Better Auth genuinely has 2FA enabled for them (enable() is
// password-gated, so reaching this already required re-authentication).
export const confirmMfaSetup = authedMutation({
  args: { method: v.union(v.literal("totp"), v.literal("email")) },
  returns: v.null(),
  handler: async (ctx, { method }) => {
    const enabled = await ctx.runQuery(
      components.betterAuth.provisioning.hasTwoFactorEnabled,
      { userId: ctx.authUserId }
    )
    if (!enabled) throw appError(ERROR_CODES.invalidInput)
    const row = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", ctx.authUserId))
      .unique()
    if (row === null) throw appError(ERROR_CODES.notFound)
    await ctx.db.patch(row._id, { mfaMethod: method, mfaConfirmedAt: Date.now() })
    return null
  },
})
```
Audit note (deviation): no `logAudit` call here. See the Global Constraints audit note. If the reviewer wants an org-scoped `mfa.enabled` event, change `confirmMfaSetup` to `orgMutation` (it then takes `orgId`, which the gate already resolves and would pass), add `AUDIT_EVENTS.mfaEnabled = "mfa.enabled"` + its payload `{ method }` in `lib/auditPayloads.ts`, map `"mfa." -> "member"` in `categoryForEvent`, and call `ctx.audit.log({ type: AUDIT_EVENTS.mfaEnabled, payload: { method } })`.

- [ ] **Step 8: Run the tests, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter @workspace/backend test -- twoFactor`
Expected: PASS (5 tests).

- [ ] **Step 9: Typecheck + commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
git add packages/backend/convex/accounts/tables.ts packages/backend/convex/lib/functions.ts packages/backend/convex/betterAuth/provisioning.ts packages/backend/convex/betterAuth/testing.ts packages/backend/convex/accounts/twoFactor.ts packages/backend/convex/accounts/twoFactor.test.ts
git commit -m "feat(auth): track per-user 2FA setup state with status query and confirm mutation"
```

---

## Task 5: `TwoFactorGate` in the authenticated layout

Blocks the app until `getMyMfaStatus` reports confirmed. Renders a placeholder setup component for now (the real wizard is Task 6) so the gate is independently testable.

**Files:**
- Modify: `apps/dashboard/app/(app)/layout.tsx`
- Create: `apps/dashboard/components/auth/two-factor-gate.tsx`
- Create (placeholder, replaced in Task 6): `apps/dashboard/components/auth/two-factor-setup.tsx`
- Test: `apps/dashboard/components/auth/two-factor-gate.test.tsx`

**Interfaces:**
- Consumes (Task 4): `api.accounts.twoFactor.getMyMfaStatus`.
- Produces (Task 6): `<TwoFactorGate>{children}</TwoFactorGate>` renders `<TwoFactorSetup onConfirmed={...} />` when unconfirmed, children when confirmed. `TwoFactorSetup` prop contract: `{ onConfirmed: () => void }` (Task 6 fills the body; the gate relies only on this prop and on `getMyMfaStatus` flipping reactively).

- [ ] **Step 1: Write the failing gate test**

Create `apps/dashboard/components/auth/two-factor-gate.test.tsx`:
```tsx
import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const useQueryMock = vi.fn()
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
}))
vi.mock("@/components/auth/two-factor-setup", () => ({
  TwoFactorSetup: () => <div data-testid="setup" />,
}))

import { TwoFactorGate } from "@/components/auth/two-factor-gate"

function renderGate() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorGate>
        <div data-testid="children" />
      </TwoFactorGate>
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("TwoFactorGate", () => {
  it("shows a spinner while the status query is loading", () => {
    useQueryMock.mockReturnValue(undefined)
    renderGate()
    expect(screen.queryByTestId("children")).toBeNull()
    expect(screen.queryByTestId("setup")).toBeNull()
  })

  it("shows the setup wizard when 2FA is not confirmed", () => {
    useQueryMock.mockReturnValue({ confirmed: false, method: null })
    renderGate()
    expect(screen.getByTestId("setup")).toBeDefined()
    expect(screen.queryByTestId("children")).toBeNull()
  })

  it("renders children when 2FA is confirmed", () => {
    useQueryMock.mockReturnValue({ confirmed: true, method: "totp" })
    renderGate()
    expect(screen.getByTestId("children")).toBeDefined()
    expect(screen.queryByTestId("setup")).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- two-factor-gate`
Expected: FAIL (`TwoFactorGate` / `TwoFactorSetup` modules do not exist).

- [ ] **Step 3: Create the placeholder `TwoFactorSetup`**

Create `apps/dashboard/components/auth/two-factor-setup.tsx`:
```tsx
"use client"

// Placeholder; the full setup wizard is implemented in the next task. The gate
// only relies on the onConfirmed prop and on getMyMfaStatus flipping reactively
// after confirmMfaSetup runs.
export function TwoFactorSetup({ onConfirmed }: { onConfirmed: () => void }) {
  void onConfirmed
  return null
}
```

- [ ] **Step 4: Create the gate**

Create `apps/dashboard/components/auth/two-factor-gate.tsx`:
```tsx
"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Spinner } from "@workspace/ui/components/spinner"
import { useQuery } from "convex/react"
import { useTranslations } from "next-intl"
import type { ReactNode } from "react"
import { TwoFactorSetup } from "@/components/auth/two-factor-setup"

// Mandatory-2FA gate. Sits above OnboardingGate in the (app) layout: an
// authenticated user without a confirmed second factor is held in setup before
// the org wizard or the dashboard. "confirmed" is our own mfaConfirmedAt marker
// (see accounts/twoFactor.ts), not Better Auth's twoFactorEnabled.
export function TwoFactorGate(props: { children: ReactNode }) {
  const t = useTranslations("dashboard.auth")
  const status = useQuery(api.accounts.twoFactor.getMyMfaStatus, {})

  if (status === undefined) {
    return (
      <main className="flex min-h-svh items-center justify-center">
        <Spinner aria-label={t("loading")} />
      </main>
    )
  }
  if (!status.confirmed) {
    // onConfirmed is a no-op: confirmMfaSetup updates server state, getMyMfaStatus
    // re-runs reactively, and this gate re-renders into its children.
    return <TwoFactorSetup onConfirmed={() => {}} />
  }
  return <>{props.children}</>
}
```

- [ ] **Step 5: Run the test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- two-factor-gate`
Expected: PASS (3 tests).

- [ ] **Step 6: Insert the gate into the app layout**

In `apps/dashboard/app/(app)/layout.tsx`, add the import:
```tsx
import { TwoFactorGate } from "@/components/auth/two-factor-gate"
```
Wrap `OnboardingGate` with `TwoFactorGate` inside `<Authenticated>`:
```tsx
      <Authenticated>
        <TwoFactorGate>
          <OnboardingGate>{props.children}</OnboardingGate>
        </TwoFactorGate>
      </Authenticated>
```

- [ ] **Step 7: Typecheck + commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
git add "apps/dashboard/app/(app)/layout.tsx" apps/dashboard/components/auth/two-factor-gate.tsx apps/dashboard/components/auth/two-factor-setup.tsx apps/dashboard/components/auth/two-factor-gate.test.tsx
git commit -m "feat(auth): gate the app behind mandatory 2FA setup"
```

---

## Task 6: `TwoFactorSetup` wizard (method choice, confirm password, TOTP/email)

Replaces the placeholder with the real enrollment flow. Adds the QR dependency and the code/password Zod factories.

**Files:**
- Modify: `apps/dashboard/package.json` (add `qrcode`, `@types/qrcode`)
- Create: `apps/dashboard/lib/two-factor-schemas.ts`
- Modify: `apps/dashboard/components/auth/two-factor-setup.tsx` (replace placeholder)
- Test: `apps/dashboard/components/auth/two-factor-setup.test.tsx`

**Interfaces:**
- Consumes (Task 1) `dashboard.twoFactorSetup.*` + `dashboard.help.twoFactor*`; (Task 3) `authClient.twoFactor.{enable,verifyTotp,sendOtp,verifyOtp}`; (Task 4) `api.accounts.twoFactor.confirmMfaSetup`.
- Produces: the real `TwoFactorSetup({ onConfirmed })`.

- [ ] **Step 1: Add the QR dependency**

Run:
```bash
cd /Volumes/development/blueprnt/frontend/apps/dashboard
bun add qrcode
bun add -d @types/qrcode
```

- [ ] **Step 2: Create the Zod factories**

Create `apps/dashboard/lib/two-factor-schemas.ts`:
```typescript
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// 6-digit code field shared by the setup and challenge screens.
export function makeCodeSchema(t: ValidationT) {
  return z.object({
    code: z.string().regex(/^\d{6}$/, t("required")),
  })
}
export type CodeValues = z.infer<ReturnType<typeof makeCodeSchema>>

// Password re-confirmation before enable().
export function makeConfirmPasswordSchema(t: ValidationT) {
  return z.object({
    password: z.string().min(1, t("required")),
  })
}
export type ConfirmPasswordValues = z.infer<
  ReturnType<typeof makeConfirmPasswordSchema>
>
```

- [ ] **Step 3: Write the failing setup test**

Create `apps/dashboard/components/auth/two-factor-setup.test.tsx`:
```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const enable = vi.fn()
const verifyTotp = vi.fn()
const sendOtp = vi.fn()
const verifyOtp = vi.fn()
const confirmMfaSetup = vi.fn()
const activeOrg = { data: { id: "o1", name: "Acme" } }

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      enable: (...a: unknown[]) => enable(...a),
      verifyTotp: (...a: unknown[]) => verifyTotp(...a),
      sendOtp: (...a: unknown[]) => sendOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    },
    useActiveOrganization: () => activeOrg,
    useSession: () => ({ data: { user: { email: "hr@acme.se" } } }),
  },
}))
vi.mock("convex/react", () => ({
  useMutation: () => confirmMfaSetup,
}))
// qrcode touches the DOM canvas; stub it to a data URL.
vi.mock("qrcode", () => ({
  default: { toDataURL: async () => "data:image/png;base64,stub" },
}))

import { TwoFactorSetup } from "@/components/auth/two-factor-setup"

function renderSetup(onConfirmed = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorSetup onConfirmed={onConfirmed} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  enable.mockReset()
  verifyTotp.mockReset()
  sendOtp.mockReset()
  verifyOtp.mockReset()
  confirmMfaSetup.mockReset()
})

describe("TwoFactorSetup", () => {
  it("offers both methods on the first screen", () => {
    renderSetup()
    expect(
      screen.getByText(messages.dashboard.twoFactorSetup.methodTotp.label)
    ).toBeDefined()
    expect(
      screen.getByText(messages.dashboard.twoFactorSetup.methodEmail.label)
    ).toBeDefined()
  })

  it("enables and confirms via authenticator, then calls onConfirmed", async () => {
    enable.mockResolvedValue({
      data: { totpURI: "otpauth://totp/blueprnt:hr@acme.se?secret=ABC" },
      error: null,
    })
    verifyTotp.mockResolvedValue({ data: {}, error: null })
    confirmMfaSetup.mockResolvedValue(null)
    const onConfirmed = vi.fn()
    renderSetup(onConfirmed)

    // 1. choose authenticator
    fireEvent.click(
      screen.getByText(messages.dashboard.twoFactorSetup.methodTotp.label)
    )
    fireEvent.click(screen.getByRole("button", { name: messages.dashboard.twoFactorSetup.continue }))
    // 2. confirm password -> enable()
    fireEvent.change(screen.getByLabelText(messages.dashboard.twoFactorSetup.password.label), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: messages.dashboard.twoFactorSetup.password.cta }))
    await waitFor(() => expect(enable).toHaveBeenCalledWith({ password: "secret123" }))
    // 3. enter the TOTP code -> verifyTotp() + confirmMfaSetup()
    const inputs = await screen.findAllByRole("textbox")
    fireEvent.change(inputs[0], { target: { value: "123456" } })
    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" })
      expect(confirmMfaSetup).toHaveBeenCalledWith({ method: "totp" })
      expect(onConfirmed).toHaveBeenCalled()
    })
  })

  it("sends and verifies an email code when the email method is chosen", async () => {
    enable.mockResolvedValue({ data: { totpURI: "otpauth://x" }, error: null })
    sendOtp.mockResolvedValue({ data: {}, error: null })
    verifyOtp.mockResolvedValue({ data: {}, error: null })
    confirmMfaSetup.mockResolvedValue(null)
    const onConfirmed = vi.fn()
    renderSetup(onConfirmed)

    fireEvent.click(
      screen.getByText(messages.dashboard.twoFactorSetup.methodEmail.label)
    )
    fireEvent.click(screen.getByRole("button", { name: messages.dashboard.twoFactorSetup.continue }))
    fireEvent.change(screen.getByLabelText(messages.dashboard.twoFactorSetup.password.label), {
      target: { value: "secret123" },
    })
    fireEvent.click(screen.getByRole("button", { name: messages.dashboard.twoFactorSetup.password.cta }))
    await waitFor(() => expect(sendOtp).toHaveBeenCalled())
    const inputs = await screen.findAllByRole("textbox")
    fireEvent.change(inputs[0], { target: { value: "654321" } })
    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({ code: "654321" })
      expect(confirmMfaSetup).toHaveBeenCalledWith({ method: "email" })
      expect(onConfirmed).toHaveBeenCalled()
    })
  })
})
```
Note: the OTP slots render as a single hidden input from the `input-otp` library; `findAllByRole("textbox")[0]` targets it and a `change` to the full 6 digits fires `onComplete`. If the role query does not match the library's element, fall back to `container.querySelector("input")`. Verify against the rendered DOM during implementation.

- [ ] **Step 4: Run the test, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- two-factor-setup`
Expected: FAIL (the placeholder renders nothing).

- [ ] **Step 5: Implement the wizard**

Replace `apps/dashboard/components/auth/two-factor-setup.tsx` with:
```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { useMutation } from "convex/react"
import { useTranslations } from "next-intl"
import QRCode from "qrcode"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { Logo } from "@/components/logo"
import { SubmitButton } from "@/components/submit-button"
import { authClient } from "@/lib/auth-client"
import {
  type ConfirmPasswordValues,
  makeConfirmPasswordSchema,
} from "@/lib/two-factor-schemas"

type Method = "totp" | "email"
type Step = "choose" | "password" | "confirm"

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("dashboard")
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo label={t("title")} className="h-10 self-center text-brand" />
        {children}
      </div>
    </main>
  )
}

export function TwoFactorSetup({ onConfirmed }: { onConfirmed: () => void }) {
  const t = useTranslations("dashboard.twoFactorSetup")
  const tHelp = useTranslations("dashboard.help")
  const tv = useTranslations("dashboard.validation")
  const confirmMfaSetup = useMutation(api.accounts.twoFactor.confirmMfaSetup)
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""

  const [step, setStep] = useState<Step>("choose")
  const [method, setMethod] = useState<Method>("totp")
  const [totpUri, setTotpUri] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [codeError, setCodeError] = useState(false)
  const [pwError, setPwError] = useState(false)

  const pwSchema = useMemo(() => makeConfirmPasswordSchema(tv), [tv])
  const pwForm = useForm<ConfirmPasswordValues>({
    resolver: zodResolver(pwSchema),
    mode: "onTouched",
    defaultValues: { password: "" },
  })

  // Render the otpauth URI to a QR data URL for the authenticator method.
  useEffect(() => {
    if (totpUri === null) return
    void QRCode.toDataURL(totpUri).then(setQr)
  }, [totpUri])

  async function onConfirmPassword(values: ConfirmPasswordValues) {
    setPwError(false)
    const { data, error } = await authClient.twoFactor.enable({
      password: values.password,
    })
    if (error || !data) {
      setPwError(true)
      return
    }
    setTotpUri(data.totpURI)
    if (method === "email") await authClient.twoFactor.sendOtp()
    setStep("confirm")
  }

  async function onCodeComplete(value: string) {
    setCodeError(false)
    const verify =
      method === "totp"
        ? authClient.twoFactor.verifyTotp({ code: value })
        : authClient.twoFactor.verifyOtp({ code: value })
    const { error } = await verify
    if (error) {
      setCode("")
      setCodeError(true)
      return
    }
    await confirmMfaSetup({ method })
    onConfirmed()
  }

  if (step === "choose") {
    return (
      <Shell>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-1.5">
            <h1 className="text-center font-medium text-lg">{t("heading")}</h1>
            <HelpMorphButton label={tHelp("twoFactorLabel")}>
              {tHelp("twoFactorBody")}
            </HelpMorphButton>
          </div>
          <p className="text-center text-muted-foreground text-sm">{t("intro")}</p>
          {(["totp", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              aria-pressed={method === m}
              className="rounded-lg border p-4 text-left aria-pressed:border-ring aria-pressed:ring-2 aria-pressed:ring-ring/50"
            >
              <div className="font-medium text-sm">
                {t(m === "totp" ? "methodTotp.label" : "methodEmail.label")}
              </div>
              <div className="text-muted-foreground text-sm">
                {t(m === "totp" ? "methodTotp.description" : "methodEmail.description")}
              </div>
            </button>
          ))}
          <Button onClick={() => setStep("password")}>{t("continue")}</Button>
        </div>
      </Shell>
    )
  }

  if (step === "password") {
    return (
      <Shell>
        <div className="flex flex-col gap-4">
          <h1 className="text-center font-medium text-lg">{t("password.heading")}</h1>
          <p className="text-center text-muted-foreground text-sm">
            {t("password.description")}
          </p>
          <Form {...pwForm}>
            <form onSubmit={pwForm.handleSubmit(onConfirmPassword)} className="space-y-6">
              <FormField
                control={pwForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("password.label")}</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {pwError && (
                <p role="alert" className="text-destructive text-sm">
                  {t("password.error")}
                </p>
              )}
              <SubmitButton
                type="submit"
                className="w-full"
                isSubmitting={pwForm.formState.isSubmitting}
                disabled={!pwForm.formState.isValid}
              >
                {t("password.cta")}
              </SubmitButton>
            </form>
          </Form>
        </div>
      </Shell>
    )
  }

  // step === "confirm"
  return (
    <Shell>
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-center font-medium text-lg">
          {t(method === "totp" ? "totp.heading" : "email.heading")}
        </h1>
        <p className="text-center text-muted-foreground text-sm">
          {method === "totp"
            ? t("totp.description")
            : t("email.description", { email })}
        </p>
        {method === "totp" && qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt={t("totp.qrAlt")} className="size-44" />
        )}
        {method === "totp" && totpUri && (
          <p className="break-all text-center text-muted-foreground text-xs">
            {t("totp.manualKey")} {new URL(totpUri).searchParams.get("secret")}
          </p>
        )}
        <InputOTP
          maxLength={6}
          value={code}
          onChange={setCode}
          onComplete={onCodeComplete}
          autoFocus
          aria-label={t("codeLabel")}
        >
          <InputOTPGroup>
            {Array.from({ length: 6 }).map((_, i) => (
              <InputOTPSlot key={i} index={i} />
            ))}
          </InputOTPGroup>
        </InputOTP>
        {codeError && (
          <p role="alert" className="text-destructive text-sm">
            {t("verifyError")}
          </p>
        )}
        {method === "email" && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void authClient.twoFactor.sendOtp()}
          >
            {t("email.resend")}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => setStep("choose")}>
          {t("changeMethod")}
        </Button>
      </div>
    </Shell>
  )
}
```
Notes: `authClient.useSession()` supplies the email for the email-method copy. Verify `enable`/`verifyTotp`/`sendOtp`/`verifyOtp` return shapes (`{ data, error }`) and the `data.totpURI` field against the installed types; adjust if the field is named differently. The QR `img` uses a data URL (CSP-safe, no external host).

- [ ] **Step 6: Run the test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- two-factor-setup`
Expected: PASS. If the OTP input role query fails, switch to `container.querySelector("input")` as noted in Step 3.

- [ ] **Step 7: Typecheck + commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
git add apps/dashboard/package.json apps/dashboard/lib/two-factor-schemas.ts apps/dashboard/components/auth/two-factor-setup.tsx apps/dashboard/components/auth/two-factor-setup.test.tsx
# include the lockfile the bun add updated:
git add bun.lock
git commit -m "feat(auth): implement the mandatory 2FA setup wizard"
```

---

## Task 7: Sign-in second-factor challenge

Branches the sign-in screen to a challenge phase when Better Auth requires a second factor, with the polyform email-OTP look and a TOTP path.

**Files:**
- Modify: `apps/dashboard/components/auth/sign-in-screen.tsx`
- Create: `apps/dashboard/components/auth/two-factor-challenge.tsx`
- Test: `apps/dashboard/components/auth/two-factor-challenge.test.tsx`

**Interfaces:**
- Consumes (Task 1) `dashboard.auth.twoFactor.*`; (Task 3) `authClient.twoFactor.{verifyTotp,sendOtp,verifyOtp}` and `signIn.email` returning `twoFactorRedirect`.
- Produces: a `TwoFactorChallenge({ onVerified }: { onVerified: () => void })` and a sign-in screen that swaps to it.

- [ ] **Step 1: Write the failing challenge test**

Create `apps/dashboard/components/auth/two-factor-challenge.test.tsx`:
```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

const verifyTotp = vi.fn()
const sendOtp = vi.fn()
const verifyOtp = vi.fn()
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    twoFactor: {
      verifyTotp: (...a: unknown[]) => verifyTotp(...a),
      sendOtp: (...a: unknown[]) => sendOtp(...a),
      verifyOtp: (...a: unknown[]) => verifyOtp(...a),
    },
  },
}))

import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge"

function renderChallenge(onVerified = () => {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TwoFactorChallenge onVerified={onVerified} />
    </NextIntlClientProvider>
  )
}

afterEach(() => {
  cleanup()
  verifyTotp.mockReset()
  sendOtp.mockReset()
  verifyOtp.mockReset()
})

describe("TwoFactorChallenge", () => {
  it("verifies a TOTP code and calls onVerified", async () => {
    verifyTotp.mockResolvedValue({ data: {}, error: null })
    const onVerified = vi.fn()
    renderChallenge(onVerified)
    const inputs = screen.getAllByRole("textbox")
    fireEvent.change(inputs[0], { target: { value: "123456" } })
    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({ code: "123456" })
      expect(onVerified).toHaveBeenCalled()
    })
  })

  it("switches to email, sends a code, and verifies it", async () => {
    sendOtp.mockResolvedValue({ data: {}, error: null })
    verifyOtp.mockResolvedValue({ data: {}, error: null })
    const onVerified = vi.fn()
    renderChallenge(onVerified)
    fireEvent.click(screen.getByText(messages.dashboard.auth.twoFactor.useEmail))
    await waitFor(() => expect(sendOtp).toHaveBeenCalled())
    const inputs = screen.getAllByRole("textbox")
    fireEvent.change(inputs[0], { target: { value: "654321" } })
    await waitFor(() => {
      expect(verifyOtp).toHaveBeenCalledWith({ code: "654321" })
      expect(onVerified).toHaveBeenCalled()
    })
  })

  it("shows an error on a bad code without calling onVerified", async () => {
    verifyTotp.mockResolvedValue({ data: null, error: { message: "bad" } })
    const onVerified = vi.fn()
    renderChallenge(onVerified)
    const inputs = screen.getAllByRole("textbox")
    fireEvent.change(inputs[0], { target: { value: "000000" } })
    await waitFor(() => {
      expect(screen.getByText(messages.dashboard.auth.twoFactor.error)).toBeDefined()
      expect(onVerified).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run the test, expect FAIL**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- two-factor-challenge`
Expected: FAIL (component does not exist).

- [ ] **Step 3: Implement the challenge component**

Create `apps/dashboard/components/auth/two-factor-challenge.tsx`:
```tsx
"use client"

import { Button } from "@workspace/ui/components/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { authClient } from "@/lib/auth-client"

const METHOD_HINT_KEY = "blueprnt.2fa.method"

type Method = "totp" | "email"

// The sign-in second-factor screen. Defaults to the device-remembered method
// (written on a successful setup/login) and always offers the other as a
// fallback. Email is reachable for everyone (it is the universal recovery
// channel), so a lost authenticator is never a dead end.
export function TwoFactorChallenge({ onVerified }: { onVerified: () => void }) {
  const t = useTranslations("dashboard.auth.twoFactor")
  const [method, setMethod] = useState<Method>(() => {
    if (typeof window === "undefined") return "totp"
    return window.localStorage.getItem(METHOD_HINT_KEY) === "email"
      ? "email"
      : "totp"
  })
  const [code, setCode] = useState("")
  const [error, setError] = useState(false)

  // When the email method is active, request a code on entry / on switch.
  useEffect(() => {
    if (method === "email") void authClient.twoFactor.sendOtp()
  }, [method])

  async function onComplete(value: string) {
    setError(false)
    const verify =
      method === "totp"
        ? authClient.twoFactor.verifyTotp({ code: value })
        : authClient.twoFactor.verifyOtp({ code: value })
    const { error: verifyError } = await verify
    if (verifyError) {
      setCode("")
      setError(true)
      return
    }
    window.localStorage.setItem(METHOD_HINT_KEY, method)
    onVerified()
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <h1 className="text-center font-medium text-lg">{t("title")}</h1>
      <p className="text-center text-muted-foreground text-sm">
        {method === "totp" ? t("totpPrompt") : t("emailPrompt")}
      </p>
      <InputOTP
        maxLength={6}
        value={code}
        onChange={setCode}
        onComplete={onComplete}
        autoFocus
        aria-label={t("codeLabel")}
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }).map((_, i) => (
            <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {t("error")}
        </p>
      )}
      {method === "email" ? (
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => void authClient.twoFactor.sendOtp()}
          >
            {t("resend")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMethod("totp")}>
            {t("useAuthenticator")}
          </Button>
        </>
      ) : (
        <Button type="button" variant="ghost" onClick={() => setMethod("email")}>
          {t("useEmail")}
        </Button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test -- two-factor-challenge`
Expected: PASS (3 tests).

- [ ] **Step 5: Branch the sign-in screen to the challenge**

Replace `apps/dashboard/components/auth/sign-in-screen.tsx` with:
```tsx
"use client"

import { useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { EmailPasswordForm } from "@/components/auth/email-password-form"
import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge"
import { Logo } from "@/components/logo"
import { authClient } from "@/lib/auth-client"

// Rendered at / for unauthenticated visitors. Email + password first; if Better
// Auth requires a second factor (twoFactorRedirect), swap to the challenge
// before the session is created. On full success the reactive auth state swaps
// the route to the dashboard shell.
export function SignInScreen() {
  const router = useRouter()
  const t = useTranslations("dashboard")
  const [phase, setPhase] = useState<"credentials" | "challenge">("credentials")

  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <Logo label={t("title")} className="h-10 self-center text-brand" />
        {phase === "credentials" ? (
          <EmailPasswordForm
            onSubmit={async ({ email, password }) => {
              const { data, error } = await authClient.signIn.email({
                email,
                password,
              })
              if (error) throw error
              // 2FA-enabled users get twoFactorRedirect instead of a session.
              if (
                data !== null &&
                typeof data === "object" &&
                "twoFactorRedirect" in data &&
                data.twoFactorRedirect === true
              ) {
                setPhase("challenge")
                return
              }
              router.push("/")
            }}
          />
        ) : (
          <TwoFactorChallenge onVerified={() => router.push("/")} />
        )}
      </div>
    </main>
  )
}
```
Verification note: confirm how `twoFactorClient` surfaces the redirect. Per the Better Auth docs the `signIn.email` response `data` carries `twoFactorRedirect: true`; the `"twoFactorRedirect" in data` guard above handles that. If the installed client instead surfaces it via a hook/callback, adjust this branch (and add a `two-factor-redirect` test for the sign-in screen). The existing `email-password-form.test.tsx` still passes because `onSubmit` resolves normally on redirect (no throw).

- [ ] **Step 6: Run the dashboard tests, expect PASS**

Run: `cd /Volumes/development/blueprnt/frontend && bun run --filter dashboard test`
Expected: PASS (challenge tests + the existing `email-password-form` tests).

- [ ] **Step 7: Full verification + commit**

```bash
cd /Volumes/development/blueprnt/frontend
bun run turbo typecheck
bun run test
git add apps/dashboard/components/auth/sign-in-screen.tsx apps/dashboard/components/auth/two-factor-challenge.tsx apps/dashboard/components/auth/two-factor-challenge.test.tsx
git commit -m "feat(auth): challenge for the second factor on sign-in"
```

---

## Manual verification (after Task 7)

Convex-test cannot exercise the real Better Auth adapter, so verify the end-to-end flow once against a running dev backend:

1. `bun run dev` (or the project's dev command). Provision a fresh user (platform admin create-user), open the welcome email link, set a password.
2. Confirm the app holds you in the 2FA setup wizard (cannot reach the dashboard or org wizard).
3. Authenticator path: scan the QR with an authenticator app, enter the code, confirm you reach the app.
4. Sign out, sign back in: confirm the TOTP challenge appears and works; confirm "Email me a code instead" sends a code (check the email log) and verifies.
5. Repeat 1-4 with a second user choosing the email method.
6. Confirm the code email renders correctly in `bun run --filter @workspace/email <preview>` (or the project's email preview) for en and one Nordic locale.

---

## Self-Review

**1. Spec coverage:**
- Method model (pick one, email fallback, no backup codes): Task 6 (method choice), Task 7 (email fallback link). Covered.
- Shared password-then-2FA front door for creator and invitee: Task 5 gate sits in `(app)` above onboarding; the invite flow already sets a password (spec section 6). Covered.
- Always require the second factor (no device trust): Task 7 never passes `trustDevice`. Covered.
- `skipVerificationOnEnable: true` + `mfaConfirmedAt` source of truth: Tasks 3, 4. Covered.
- Re-auth before enable: Task 6 password step. Covered.
- Sign-in challenge (TOTP + email look from polyform): Task 7. Covered.
- Email template (boxed mono code), all 5 locales, locale from stored language: Tasks 1, 2, 3. Covered.
- Rate limits: Task 3. Covered.
- Audit `mfa.enabled`: deliberately NOT implemented; documented deviation in Global Constraints + Task 4 (with the exact change if the reviewer wants it). Flagged.
- Tests in the same commit: every task. Covered.

**2. Placeholder scan:** No "TBD"/"add error handling"/"similar to". The few "verify against installed types" notes are concrete verification steps for known library-signature ambiguities (`sendOTP` arg shape, `signIn.email` redirect surface, `input-otp` DOM role), each with a stated fallback, not unfinished work.

**3. Type consistency:** `getMyMfaStatus` returns `{ confirmed, method }` (Task 4) and is consumed identically in Task 5. `confirmMfaSetup({ method })` (Task 4) is called with `{ method: "totp" | "email" }` in Task 6. `TwoFactorSetup({ onConfirmed })` (Task 5 placeholder) keeps the same prop in Task 6. `TwoFactorChallenge({ onVerified })` (Task 7) is consistent across its test and the sign-in screen. Email props `{ code, email, locale }` (Task 2) match the `sendOTP` call (Task 3). Template key `"twoFactorCode"` is consistent across constants, render, and `sendOTP`.

**Known risk to watch during execution:** the three library-signature notes above. All three surface as a typecheck error or a failing test, not a silent bug.
