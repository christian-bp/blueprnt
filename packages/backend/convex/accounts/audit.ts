import { AUDIT_LOG_PAGE_SIZE } from "@workspace/constants"
import { v } from "convex/values"
import type { QueryCtx } from "../_generated/server"
import { AUDIT_CATEGORIES } from "../lib/audit"
import { locateAuditPage } from "../lib/auditAggregates"
import { adminQuery } from "../lib/functions"

// One audit row enriched with a per-row `names` map. Because the paginated
// browse query merges page arrays on the client (usePaginatedQuery), a single
// shared top-level names map cannot survive paging: each row carries only the
// ids it references, resolved to display names so the frontend renders readable
// details without exposing raw ids.
const auditRow = v.object({
  id: v.string(),
  at: v.number(),
  actorId: v.string(),
  actorName: v.string(),
  type: v.string(),
  category: v.optional(v.string()),
  payload: v.any(),
  names: v.record(v.string(), v.string()),
})

type AuditRowDoc = {
  _id: { toString(): string }
  _creationTime: number
  actorId: string
  actorName: string
  type: string
  category?: string
  payload: unknown
}

// Narrows an incoming category arg to a known AUDIT_CATEGORIES value, or null
// when it is absent/invalid (the browse query then falls back to by_org, and
// the search query drops the category filter).
function validCategory(category: string | undefined): string | null {
  if (category === undefined) return null
  return (AUDIT_CATEGORIES as readonly string[]).includes(category)
    ? category
    : null
}

// Shared name resolution for both queries. Roles and families are bounded per
// org, so they are collected wholesale (cheaper than scanning every payload);
// member auth ids and pay-mapping run labels are resolved only for the ids
// actually referenced across the given rows. Each returned row's `names` map
// contains ONLY the ids that row references (its payload
// roleId/familyId/memberUserId/runId, when present and resolvable), keeping it
// minimal per row so paging stays correct on the client.
async function enrichRows(
  ctx: QueryCtx,
  orgId: string,
  rows: AuditRowDoc[]
): Promise<Array<typeof auditRow.type>> {
  const roleTitles = new Map<string, string>()
  const familyNames = new Map<string, string>()
  const criterionNames = new Map<string, string>()
  const modelNames = new Map<string, string>()
  const roles = await ctx.db
    .query("roles")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  for (const role of roles) roleTitles.set(role._id.toString(), role.title)
  const families = await ctx.db
    .query("roleFamilies")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  for (const family of families)
    familyNames.set(family._id.toString(), family.name)
  // Criteria and the org's model(s) are bounded per org, so they are collected
  // wholesale (like roles/families) to resolve top-level payload.criterionId /
  // payload.modelId into the names map for the detail sheet's context line.
  const criteria = await ctx.db
    .query("criteria")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  for (const criterion of criteria)
    criterionNames.set(criterion._id.toString(), criterion.name)
  const models = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  for (const model of models) modelNames.set(model._id.toString(), model.name)
  // Pay-mapping runs resolve payload.runId into the names map so every
  // payMapping.* row is attributable to its kartläggning (two runs in flight
  // are otherwise indistinguishable in the log). Resolved per referenced id
  // (the memberNames pattern below), not a wholesale collect: run docs carry
  // the frozen model and the samverkan participants, which an audit page must
  // not read wholesale just to project labels. A hard-deleted run resolves
  // nothing; the runDeleted row itself carries the captured `label` instead,
  // and the run's other rows render the localized deleted-run marker.
  const runLabels = new Map<string, string>()
  const runIds = new Set<string>()
  for (const row of rows) {
    const runId = (row.payload as Record<string, unknown> | null)?.runId
    if (typeof runId === "string") runIds.add(runId)
  }
  for (const id of runIds) {
    const docId = ctx.db.normalizeId("payMappingRuns", id)
    if (docId === null) continue
    const run = await ctx.db.get(docId)
    // The id comes from a stored payload: re-check the org before projecting.
    if (run !== null && run.orgId === orgId) runLabels.set(id, run.label)
  }

  // Member identities live in the users mirror (keyed by authId), not the org
  // tables. Resolve only the auth ids actually referenced across these rows.
  const memberNames = new Map<string, string>()
  const memberIds = new Set<string>()
  for (const row of rows) {
    const memberUserId = (row.payload as Record<string, unknown> | null)
      ?.memberUserId
    if (typeof memberUserId === "string") memberIds.add(memberUserId)
  }
  for (const authId of memberIds) {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_id", (q) => q.eq("authId", authId))
      .first()
    if (user !== null) memberNames.set(authId, user.name || user.email)
  }

  return rows.map((row) => {
    const payload = (row.payload as Record<string, unknown> | null) ?? {}
    const names: Record<string, string> = {}
    const roleId = payload.roleId
    if (typeof roleId === "string" && roleTitles.has(roleId)) {
      names[roleId] = roleTitles.get(roleId) as string
    }
    // assignment.set diffs the role (changes.roleId.{from,to}); resolve both
    // sides so a re-assignment shows role titles, never a raw id, in the sheet.
    const roleChange = (payload.changes as Record<string, unknown> | undefined)
      ?.roleId as Record<string, unknown> | undefined
    if (roleChange != null && typeof roleChange === "object") {
      for (const side of ["from", "to"] as const) {
        const value = roleChange[side]
        if (typeof value === "string" && roleTitles.has(value)) {
          names[value] = roleTitles.get(value) as string
        }
      }
    }
    const familyId = payload.familyId
    if (typeof familyId === "string" && familyNames.has(familyId)) {
      names[familyId] = familyNames.get(familyId) as string
    }
    const criterionId = payload.criterionId
    if (typeof criterionId === "string" && criterionNames.has(criterionId)) {
      names[criterionId] = criterionNames.get(criterionId) as string
    }
    const modelId = payload.modelId
    if (typeof modelId === "string" && modelNames.has(modelId)) {
      names[modelId] = modelNames.get(modelId) as string
    }
    const runId = payload.runId
    if (typeof runId === "string" && runLabels.has(runId)) {
      names[runId] = runLabels.get(runId) as string
    }
    const memberUserId = payload.memberUserId
    if (typeof memberUserId === "string" && memberNames.has(memberUserId)) {
      names[memberUserId] = memberNames.get(memberUserId) as string
    }
    return {
      id: row._id.toString(),
      at: row._creationTime,
      actorId: row.actorId,
      actorName: row.actorName,
      type: row.type,
      ...(row.category !== undefined ? { category: row.category } : {}),
      payload: row.payload,
      names,
    }
  })
}

// One page of the organization's event trail (admin-only), newest-first, by
// PAGE NUMBER rather than cursor: the audit aggregates (lib/auditAggregates)
// resolve the exact matching total and the _creationTime the page starts at
// in O(log n), so the pager can show a real page count and jump straight to
// any page (including the last) without loading the pages before it. When
// `category` is a known AUDIT_CATEGORIES value the by_org_category index
// scopes the rows; otherwise the full by_org trail pages. The optional
// `start`/`end` epoch-ms bounds restrict `_creationTime` inclusively. A page
// past the end returns an empty page with the total (the client clamps).
// Reactive like any query: new rows shift the pages live.
export const getAuditLogPage = adminQuery({
  args: {
    page: v.number(),
    category: v.optional(v.string()),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  returns: v.object({ rows: v.array(auditRow), total: v.number() }),
  handler: async (ctx, args) => {
    const category = validCategory(args.category)
    // Number.isFinite guards NaN/Infinity (v.number() admits both); either
    // would otherwise reach the aggregate as a non-integer offset and throw.
    const page = Number.isFinite(args.page)
      ? Math.max(0, Math.floor(args.page))
      : 0
    const { total, pageStart } = await locateAuditPage(ctx, {
      orgId: ctx.orgId,
      category,
      start: args.start,
      end: args.end,
      offset: page * AUDIT_LOG_PAGE_SIZE,
    })
    if (pageStart === null) return { rows: [], total }
    const { start } = args
    // The page's rows: descending from its newest row's _creationTime
    // (inclusive), floored by the range start; take() ends the page. The
    // range end needs no clause here: pageStart already lies within it.
    // Explicit branches: the builder's type narrows after the first .gte.
    const rows =
      category !== null
        ? await ctx.db
            .query("auditLog")
            .withIndex("by_org_category", (q) => {
              const base = q.eq("orgId", ctx.orgId).eq("category", category)
              return start !== undefined
                ? base
                    .gte("_creationTime", start)
                    .lte("_creationTime", pageStart)
                : base.lte("_creationTime", pageStart)
            })
            .order("desc")
            .take(AUDIT_LOG_PAGE_SIZE)
        : await ctx.db
            .query("auditLog")
            .withIndex("by_org", (q) => {
              const base = q.eq("orgId", ctx.orgId)
              return start !== undefined
                ? base
                    .gte("_creationTime", start)
                    .lte("_creationTime", pageStart)
                : base.lte("_creationTime", pageStart)
            })
            .order("desc")
            .take(AUDIT_LOG_PAGE_SIZE)
    return { rows: await enrichRows(ctx, ctx.orgId, rows), total }
  },
})

// Full-text search over the org's audit trail (admin-only). Search results are
// relevance-ranked, capped, and NOT paginated (Convex search indexes are not
// .order()-able and have no cursor), so this is a separate query the client
// uses while a search term is active; an empty term returns no rows and the
// client falls back to the paginated browse query above. A known category
// further constrains the search via the index filter fields.
export const searchAuditLog = adminQuery({
  args: {
    search: v.string(),
    category: v.optional(v.string()),
    start: v.optional(v.number()),
    end: v.optional(v.number()),
  },
  returns: v.object({ rows: v.array(auditRow) }),
  handler: async (ctx, args) => {
    const search = args.search.trim()
    if (search.length === 0) return { rows: [] }
    const category = validCategory(args.category)
    const { start, end } = args
    const rows = await ctx.db
      .query("auditLog")
      .withSearchIndex("search_text", (q) => {
        let s = q.search("searchText", search).eq("orgId", ctx.orgId)
        if (category !== null) s = s.eq("category", category)
        return s
      })
      .take(50)
    // The search index filterFields are equality-only, so the date range cannot
    // be an index filter: apply it in memory over the top-50 relevance results.
    // A date-filtered search may therefore return fewer than 50 rows (the range
    // is intersected with the relevance cap, not applied before it).
    const inRange = rows.filter(
      (r) =>
        (start === undefined || r._creationTime >= start) &&
        (end === undefined || r._creationTime <= end)
    )
    return { rows: await enrichRows(ctx, ctx.orgId, inRange) }
  },
})
