import { renderEmail, type EmailTemplateKey } from "@workspace/email"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalAction, internalMutation } from "../_generated/server"

const MAX_ATTEMPTS = 3
const BACKOFF_MS = [0, 30_000, 120_000]

// Domain not yet verified at Scaleway; founder configures EMAIL_FROM. Default
// keeps the sender working once the domain is verified without a code change.
const FROM_EMAIL = process.env.EMAIL_FROM ?? "no-reply@blueprnt.se"

const templateKeyValidator = v.union(
  v.literal("invitation"),
  v.literal("verifyEmail"),
  v.literal("resetPassword")
)

// Transactional with the caller's mutation: an invite that commits always
// has its email row committed with it.
export const enqueueEmail = internalMutation({
  args: {
    to: v.string(),
    templateKey: templateKeyValidator,
    props: v.any(),
    locale: v.string(),
  },
  returns: v.id("emails"),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("emails", {
      ...args,
      status: "queued",
      attempts: 0,
    })
    await ctx.scheduler.runAfter(0, internal.email.outbox.deliver, {
      emailId: id,
    })
    return id
  },
})

export const deliver = internalAction({
  args: { emailId: v.id("emails") },
  returns: v.null(),
  handler: async (ctx, { emailId }) => {
    const email = await ctx.runMutation(internal.email.outbox.getForDelivery, {
      emailId,
    })
    if (email === null) return null
    const attempt = email.attempts + 1
    try {
      const rendered = await renderEmail(
        email.templateKey as EmailTemplateKey,
        {
          ...email.props,
          locale: email.locale,
        }
      )
      const region = process.env.SCW_REGION ?? "fr-par"
      const response = await fetch(
        `https://api.scaleway.com/transactional-email/v1alpha1/regions/${region}/emails`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-Token": process.env.SCW_SECRET_KEY ?? "",
          },
          body: JSON.stringify({
            from: { email: FROM_EMAIL, name: "blueprnt" },
            to: [{ email: email.to }],
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            project_id: process.env.SCW_PROJECT_ID ?? "",
          }),
          signal: AbortSignal.timeout(10_000),
        }
      )
      if (!response.ok) {
        throw new Error(
          `scaleway ${response.status}: ${(await response.text()).slice(0, 500)}`
        )
      }
      const body = (await response.json()) as { emails?: { id?: string }[] }
      await ctx.runMutation(internal.email.outbox.markSent, {
        emailId,
        attempts: attempt,
        providerMessageId: body.emails?.[0]?.id,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await ctx.runMutation(internal.email.outbox.markFailedAttempt, {
        emailId,
        attempts: attempt,
        lastError: message,
      })
      if (attempt < MAX_ATTEMPTS) {
        await ctx.scheduler.runAfter(
          BACKOFF_MS[attempt] ?? 120_000,
          internal.email.outbox.deliver,
          { emailId }
        )
      }
    }
    return null
  },
})

export const getForDelivery = internalMutation({
  args: { emailId: v.id("emails") },
  returns: v.union(v.null(), v.any()),
  handler: async (ctx, { emailId }) => {
    const email = await ctx.db.get(emailId)
    // Never re-send an already-sent email, and never double-pick a row a
    // concurrent deliver is already sending.
    if (email === null || email.status === "sent" || email.status === "sending")
      return null
    await ctx.db.patch(emailId, { status: "sending" })
    return email
  },
})

export const markSent = internalMutation({
  args: {
    emailId: v.id("emails"),
    attempts: v.number(),
    providerMessageId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { emailId, attempts, providerMessageId }) => {
    await ctx.db.patch(emailId, {
      status: "sent",
      attempts,
      providerMessageId,
    })
    return null
  },
})

export const markFailedAttempt = internalMutation({
  args: {
    emailId: v.id("emails"),
    attempts: v.number(),
    lastError: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { emailId, attempts, lastError }) => {
    await ctx.db.patch(emailId, {
      status: attempts >= MAX_ATTEMPTS ? "failed" : "queued",
      attempts,
      lastError,
    })
    return null
  },
})

// Scheduled actions are at-most-once: a crashed deliver strands rows in
// "sending" (or "queued" when its reschedule was lost). The sweep cron
// requeues stale rows and fails exhausted ones.
export const sweepStaleEmails = internalMutation({
  args: { olderThanMs: v.number() },
  returns: v.null(),
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - olderThanMs
    for (const status of ["sending", "queued"] as const) {
      const rows = await ctx.db
        .query("emails")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect()
      for (const row of rows) {
        if (row._creationTime >= cutoff) continue
        if (row.attempts >= MAX_ATTEMPTS) {
          await ctx.db.patch(row._id, {
            status: "failed",
            lastError: "stranded after crash; failed by sweep",
          })
          continue
        }
        await ctx.db.patch(row._id, { status: "queued" })
        await ctx.scheduler.runAfter(0, internal.email.outbox.deliver, {
          emailId: row._id,
        })
      }
    }
    return null
  },
})

export const cleanupOldEmails = internalMutation({
  args: { olderThanMs: v.number() },
  returns: v.null(),
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - olderThanMs
    for (const status of ["sent", "failed"] as const) {
      const rows = await ctx.db
        .query("emails")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect()
      for (const row of rows) {
        if (row._creationTime < cutoff) await ctx.db.delete(row._id)
      }
    }
    return null
  },
})
