import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"
import type { QueryCtx } from "../_generated/server"
import { AUDIT_CATEGORIES } from "../lib/audit"
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
// member auth ids are resolved only for the ids actually referenced across the
// given rows. Each returned row's `names` map contains ONLY the ids that row
// references (its payload roleId/familyId/memberUserId, when present and
// resolvable), keeping it minimal per row so paging stays correct on the client.
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

// The organization's own event trail (admin-only), paginated and newest-first.
// When `category` is a known AUDIT_CATEGORIES value the by_org_category index
// scopes the page to that area; otherwise the full by_org trail is paged. The
// returned page is enriched with per-row names. The Convex pagination result
// shape carries optional fields (splitCursor/pageStatus) the framework adds, so
// no explicit `returns` validator is set here (per the pagination guideline,
// which documents the shape but shows no returns validator on paginated
// queries): a hand-written object validator would reject those framework fields.
export const listAuditLog = adminQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = validCategory(args.category)
    const result =
      category !== null
        ? await ctx.db
            .query("auditLog")
            .withIndex("by_org_category", (q) =>
              q.eq("orgId", ctx.orgId).eq("category", category)
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await ctx.db
            .query("auditLog")
            .withIndex("by_org", (q) => q.eq("orgId", ctx.orgId))
            .order("desc")
            .paginate(args.paginationOpts)
    return {
      ...result,
      page: await enrichRows(ctx, ctx.orgId, result.page),
    }
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
  },
  returns: v.object({ rows: v.array(auditRow) }),
  handler: async (ctx, args) => {
    const search = args.search.trim()
    if (search.length === 0) return { rows: [] }
    const category = validCategory(args.category)
    const rows = await ctx.db
      .query("auditLog")
      .withSearchIndex("search_text", (q) => {
        let s = q.search("searchText", search).eq("orgId", ctx.orgId)
        if (category !== null) s = s.eq("category", category)
        return s
      })
      .take(50)
    return { rows: await enrichRows(ctx, ctx.orgId, rows) }
  },
})
