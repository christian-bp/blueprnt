import { renderEmail, type EmailTemplateKey } from "@workspace/email"
import { v } from "convex/values"
import { internal } from "../_generated/api"
import { internalAction, internalMutation } from "../_generated/server"
import { sweego } from "./client"
import { vTemplateKey } from "./templates"

// Domain configured at Sweego; the founder sets EMAIL_FROM. The default keeps
// the sender working once the domain is verified without a code change. The
// "Name <addr>" form is parsed by the Sweego client into a display name +
// address, and hello@ is a replyable mailbox (not no-reply).
const FROM_EMAIL = process.env.EMAIL_FROM ?? "blueprnt <hello@blueprnt.se>"

const deliverArgs = {
  to: v.string(),
  templateKey: vTemplateKey,
  props: v.any(),
  locale: v.string(),
}

// Transactional with the caller's mutation (e.g. an invite): the scheduled
// deliver commits with the triggering write, so the email is rendered + handed
// to Sweego iff that write commits. Durable delivery, retries, idempotency, and
// delivery tracking are owned by the Sweego component (see ./client).
//
// The hand-off stays a separate scheduled action on purpose. renderEmail can run
// in the mutation runtime, so the render + send could be inlined here; we keep
// the action so enqueueEmail's scheduling is unit-testable without registering
// Sweego's nested send workpool (which even the component's own suite avoids).
// The action is at-most-once: durability begins once sweego.sendEmail commits
// its enqueue, so the narrow render + single-RPC window before that is not
// retried. Acceptable for low-volume auth mail with deterministic rendering.
export const enqueueEmail = internalMutation({
  args: deliverArgs,
  returns: v.null(),
  handler: async (ctx, params) => {
    await ctx.scheduler.runAfter(0, internal.email.outbox.deliver, params)
    return null
  },
})

export const deliver = internalAction({
  args: deliverArgs,
  returns: v.null(),
  handler: async (ctx, { to, templateKey, props, locale }) => {
    const rendered = await renderEmail(templateKey as EmailTemplateKey, {
      ...props,
      locale,
    })
    await sweego.sendEmail(ctx, {
      from: FROM_EMAIL,
      to,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      // Tag with the template type so the admin email log can group / filter.
      campaignTags: [templateKey],
    })
    return null
  },
})
