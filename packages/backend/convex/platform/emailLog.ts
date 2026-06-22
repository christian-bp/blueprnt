import type { MessageId } from "@christian-ek/sweego"
import { paginationOptsValidator } from "convex/server"
import { type Infer, v } from "convex/values"
import { sweego } from "../email/client"
import { vTemplateKey } from "../email/templates"
import { platformQuery } from "../lib/functions"

// Email delivery history lives in the Sweego component (it owns sends, retries,
// and webhook-driven delivery tracking). These platform-admin queries are thin,
// PII-curated read wrappers over the component's list / search / get / bounds,
// reshaped into stable DTOs so the admin UI never depends on the component's
// internal schema. Access is gated by `platformQuery` (requirePlatformAdmin);
// the email log surfaces recipient addresses + rendered bodies, operator-only.

// Mirrors the component's vSendStatus (logical send lifecycle).
const vSendStatus = v.union(
  v.literal("queued"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("cancelled")
)

// Mirrors the component's vDeliveryStatus (per-recipient outcome).
const vDeliveryStatus = v.union(
  v.literal("pending"),
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("soft_bounced"),
  v.literal("bounced"),
  v.literal("undelivered"),
  v.literal("stopped")
)

const vChannel = v.union(v.literal("email"), v.literal("sms"))

// The "type" filter is keyed on blueprnt's template keys (the campaignTags each
// send is tagged with). The validator is shared with the send path via
// ../email/templates so the two cannot drift. The component filters by an opaque
// tag string; the typed enum lives on the consumer side.

// One row of the email-log table: a lightweight summary (no body/recipients).
const vEmailLogRow = v.object({
  messageId: v.string(),
  channel: vChannel,
  status: vSendStatus,
  subject: v.union(v.string(), v.null()),
  recipientCount: v.number(),
  campaignTags: v.array(v.string()),
  errorMessage: v.union(v.string(), v.null()),
  createdAt: v.number(),
})

// The per-message fields the table needs from the component's list/search
// items, derived from the row validator so the shape has one source of truth.
// A structural subset, so component list items map cleanly to the DTO.
type ComponentRow = Infer<typeof vEmailLogRow>

// Reshape a component message-list item into the table-row DTO (drops the
// component-internal fields the table does not show).
function toRow(m: ComponentRow) {
  return {
    messageId: m.messageId,
    channel: m.channel,
    status: m.status,
    subject: m.subject,
    recipientCount: m.recipientCount,
    campaignTags: m.campaignTags,
    errorMessage: m.errorMessage,
    createdAt: m.createdAt,
  }
}

// Paginated browse (newest first), filterable by status, template type, and an
// inclusive creation-time range. Native pagination for `usePaginatedQuery`.
export const list = platformQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(vSendStatus),
    tag: v.optional(vTemplateKey),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  handler: async (ctx, { paginationOpts, status, tag, start, end }) => {
    const result = await sweego.list(ctx, {
      paginationOpts,
      status,
      tag,
      // blueprnt only sends email; scope the log to it so it stays correct if
      // SMS is ever added.
      channel: "email",
      start,
      end,
    })
    return { ...result, page: result.page.map(toRow) }
  },
})

// Full-text search over subject + recipients (relevance-ranked, capped, not
// paginated); same status/type/date filters as `list`. A separate query the
// client swaps to while a search term is active.
export const search = platformQuery({
  args: {
    search: v.string(),
    status: v.optional(vSendStatus),
    tag: v.optional(vTemplateKey),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  returns: v.object({ page: v.array(vEmailLogRow) }),
  handler: async (ctx, { search, status, tag, start, end }) => {
    const result = await sweego.search(ctx, {
      search,
      status,
      tag,
      channel: "email",
      start,
      end,
    })
    return { page: result.page.map(toRow) }
  },
})

// Earliest message time (epoch ms) for the date-range picker default, or null.
export const bounds = platformQuery({
  args: {},
  returns: v.object({ earliest: v.union(v.number(), v.null()) }),
  handler: async (ctx) => sweego.bounds(ctx),
})

const vEmailAddress = v.object({
  email: v.string(),
  name: v.union(v.string(), v.null()),
})

const vDeliveryView = v.object({
  recipientKey: v.string(),
  status: vDeliveryStatus,
  lastEventType: v.union(v.string(), v.null()),
  delivered: v.boolean(),
  bounced: v.boolean(),
  softBounced: v.boolean(),
  complained: v.boolean(),
  unsubscribed: v.boolean(),
  opened: v.boolean(),
  clicked: v.boolean(),
  stopped: v.boolean(),
  errorMessage: v.union(v.string(), v.null()),
})

// Full detail for one message: metadata, recipients, the rendered body (for the
// preview), and per-recipient delivery state. Drives the detail sheet.
const vEmailLogDetail = v.object({
  messageId: v.string(),
  channel: vChannel,
  status: vSendStatus,
  subject: v.union(v.string(), v.null()),
  from: v.union(vEmailAddress, v.null()),
  to: v.array(vEmailAddress),
  campaignTags: v.array(v.string()),
  transactionId: v.union(v.string(), v.null()),
  errorMessage: v.union(v.string(), v.null()),
  html: v.union(v.string(), v.null()),
  text: v.union(v.string(), v.null()),
  createdAt: v.number(),
  finalizedAt: v.number(),
  deliveries: v.array(vDeliveryView),
})

export const get = platformQuery({
  args: { messageId: v.string() },
  returns: v.union(v.null(), vEmailLogDetail),
  handler: async (ctx, { messageId }) => {
    const m = await sweego.get(ctx, messageId as MessageId)
    if (m === null) return null
    return {
      messageId: m._id as string,
      channel: m.channel,
      status: m.status,
      subject: m.subject ?? null,
      from: m.from ? { email: m.from.email, name: m.from.name ?? null } : null,
      to: (m.emailRecipients ?? []).map((r) => ({
        email: r.email,
        name: r.name ?? null,
      })),
      campaignTags: m.campaignTags ?? [],
      transactionId: m.transactionId ?? null,
      errorMessage: m.errorMessage ?? null,
      html: m.html ?? null,
      text: m.text ?? null,
      createdAt: m._creationTime,
      finalizedAt: m.finalizedAt,
      deliveries: m.deliveries.map((d) => ({
        recipientKey: d.recipientKey,
        status: d.status,
        lastEventType: d.lastEventType,
        delivered: d.delivered,
        bounced: d.bounced,
        softBounced: d.softBounced,
        complained: d.complained,
        unsubscribed: d.unsubscribed,
        opened: d.opened,
        clicked: d.clicked,
        stopped: d.stopped,
        errorMessage: d.errorMessage,
      })),
    }
  },
})
