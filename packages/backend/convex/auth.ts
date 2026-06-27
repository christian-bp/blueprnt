import {
  type AuthFunctions,
  createClient,
  type GenericCtx,
} from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils"
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal"
import { haveIBeenPwned, organization, twoFactor } from "better-auth/plugins"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"
import { ac, admin, editor } from "./betterAuth/permissions"
import authSchema from "./betterAuth/schema"
import {
  onInvitationCreate,
  onInvitationUpdate,
  onMemberCreate,
  onMemberDelete,
  onMemberUpdate,
  onOrganizationCreate,
  onUserCreate,
  onUserDelete,
  onUserUpdate,
} from "./accounts/mirrors"

function requireSiteUrl(): string {
  const url = process.env.SITE_URL
  if (!url) {
    throw new Error("SITE_URL env var is not set on the deployment")
  }
  return url
}

const authFunctions: AuthFunctions = internal.auth

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: { schema: authSchema },
    authFunctions,
    triggers: {
      user: {
        onCreate: async (ctx, doc) => {
          await onUserCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onUserUpdate(ctx, newDoc, oldDoc)
        },
        onDelete: async (ctx, doc) => {
          await onUserDelete(ctx, doc)
        },
      },
      organization: {
        onCreate: async (ctx, doc) => {
          await onOrganizationCreate(ctx, doc)
        },
      },
      member: {
        onCreate: async (ctx, doc) => {
          await onMemberCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onMemberUpdate(ctx, newDoc, oldDoc)
        },
        onDelete: async (ctx, doc) => {
          await onMemberDelete(ctx, doc)
        },
      },
      invitation: {
        onCreate: async (ctx, doc) => {
          await onInvitationCreate(ctx, doc)
        },
        onUpdate: async (ctx, newDoc, oldDoc) => {
          await onInvitationUpdate(ctx, newDoc, oldDoc)
        },
      },
    },
  }
)

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

export const createAuthOptions = (
  ctx: GenericCtx<DataModel>,
  overrides?: { baseURL?: string }
) => {
  // Hoisted so both baseURL and the invite accept link use the same value.
  // Analysis/codegen contexts pass an override and must not call requireSiteUrl.
  const resolvedBaseUrl = overrides?.baseURL ?? requireSiteUrl()
  return {
    baseURL: resolvedBaseUrl,
    database: authComponent.adapter(ctx),
    // Persist reset-throttle counters in the component's rateLimit table so
    // they survive across Convex isolates (in-memory counters reset per
    // isolate and would not throttle reliably). Verified against the installed
    // better-auth 1.6.17 (storage accepts "database") and
    // @convex-dev/better-auth 0.12.3 (its component schema provides a
    // rateLimit table). Tight caps on the password-reset request endpoints.
    rateLimit: {
      storage: "database",
      customRules: {
        "/request-password-reset": { window: 60, max: 3 },
        "/forget-password": { window: 60, max: 3 },
        // Credential email sign-in: throttle brute-force / credential stuffing.
        // Key is the base-path-stripped route ("/api/auth" prefix is removed
        // before matching). Verified against better-auth 1.6.17:
        // createAuthEndpoint("/sign-in/email", ...).
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/send-otp": { window: 60, max: 3 },
        "/two-factor/verify-otp": { window: 60, max: 5 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
      },
    },
    emailAndPassword: {
      enabled: true,
      // No self-serve account creation: accounts are provisioned by an
      // admin (dev seed today, invitation flow later). This closes the
      // public sign-up endpoint, not just the UI.
      disableSignUp: true,
      // A password reset invalidates every existing session for that user, so
      // a leaked/old session cannot survive the reset.
      revokeSessionsOnPasswordReset: true,
      // Minimum password length, enforced server-side (the reset form mirrors
      // this as a client gate; the server is authoritative).
      minPasswordLength: 8,
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
    },
    // Double opt-in email change: hop 1 sends a confirmation link to the
    // CURRENT address; hop 2 (via emailVerification.sendVerificationEmail)
    // sends a verify link to the NEW address once the user clicks hop 1.
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          const mctx = requireRunMutationCtx(ctx)
          const settings = await mctx.runQuery(
            internal.accounts.organization.getLanguageForUser,
            { userId: user.id }
          )
          await mctx.runMutation(internal.email.outbox.enqueueEmail, {
            to: user.email,
            templateKey: "changeEmailConfirm",
            props: { url, newEmail },
            locale: settings?.language ?? "en",
          })
        },
      },
    },
    // Hop 2 of the email change flow: Better Auth calls this with
    // user.email already set to the NEW address, so enqueuing to user.email
    // delivers the verify link to the right inbox. Also used by Better Auth
    // for any other email verification flow (required by BA when changeEmail
    // is enabled, otherwise BA throws "Verification email isn't enabled").
    // Rewrite the callbackURL so the hop-2 link lands on its own page with
    // accurate "email updated" copy, not the hop-1 "check your inbox" copy.
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        const mctx = requireRunMutationCtx(ctx)
        const settings = await mctx.runQuery(
          internal.accounts.organization.getLanguageForUser,
          { userId: user.id }
        )
        const u = new URL(url)
        u.searchParams.set("callbackURL", "/change-email?step=done")
        await mctx.runMutation(internal.email.outbox.enqueueEmail, {
          to: user.email,
          templateKey: "verifyEmail",
          props: { url: u.toString() },
          locale: settings?.language ?? "en",
        })
      },
    },
    // Session lifetime hardening. All values in SECONDS (verified against
    // @better-auth/core 1.6.17 types). Defaults are 7d / 1d / 1d; kept explicit
    // so the posture is reviewable and pinned against future default changes.
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 60 * 24,
    },
    advanced: {
      // Force the Secure attribute (and __Secure- prefix) in production. Gated
      // so local http://localhost sign-in is not broken (browsers drop Secure
      // cookies on http). The Convex Next proxy forwards x-forwarded-proto, so
      // this makes the secure posture deterministic behind Vercel.
      useSecureCookies: process.env.NODE_ENV === "production",
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      },
    },
    // Origins better-auth trusts for CSRF / redirect validation (checked
    // server-side in Convex against the forwarded host/origin). Use the
    // dashboard's public origin, NOT the .convex.site backend URL.
    trustedOrigins: [resolvedBaseUrl],
    plugins: [
      organization({
        ac,
        roles: { admin, editor },
        creatorRole: "admin",
        // Deliberate V1 posture: tenant deletion is an out-of-band support
        // operation. No product path to delete an organization exists.
        // Revisit post-V1.
        disableOrganizationDeletion: true,
        sendInvitationEmail: async (data) => {
          const mctx = requireRunMutationCtx(ctx)
          // Resolve the organization's language so the invite goes out in the
          // org's locale; fall back to en if the settings have no language set.
          const settings = await mctx.runQuery(
            internal.accounts.organization.getLanguageForOrg,
            { orgId: data.organization.id }
          )
          await mctx.runMutation(internal.email.outbox.enqueueEmail, {
            to: data.email,
            templateKey: "invitation",
            props: {
              inviterName: data.inviter.user.name,
              organizationName: data.organization.name,
              acceptUrl: `${resolvedBaseUrl}/accept-invitation/${data.id}`,
            },
            locale: settings?.language ?? "en",
          })
        },
      }),
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
            // Pre-launch dev convenience: surface the code in the Convex logs so
            // local testing needs no inbox. NODE_ENV gates it OFF on production
            // builds. Tracked in docs/go-live-checklist.md.
            if (process.env.NODE_ENV !== "production") {
              console.log(`[dev] 2FA OTP for ${user.email}: ${otp}`)
            }
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
      // Reject passwords found in the Have I Been Pwned breach corpus at
      // set/reset time (NIST 800-63B's recommended control over composition
      // rules: a never-leaked short password beats a complex breached one).
      // k-anonymity: only a 5-char SHA-1 prefix is sent to the HIBP range API,
      // never the password or any PII. On a hit it rejects with a 400 carrying
      // code "PASSWORD_COMPROMISED"; the frontend translates it, so no
      // hardcoded message here. Default paths cover /reset-password.
      haveIBeenPwned(),
      convex({ authConfig }),
    ],
  } satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth(createAuthOptions(ctx))
