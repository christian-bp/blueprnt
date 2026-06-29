import { slugify } from "@workspace/constants"
import type { Id } from "../_generated/dataModel"
import type { MutationCtx } from "../_generated/server"

// Tables whose rows are reachable by their own route and therefore carry a
// human-readable, per-org-unique `slug` (resolved via the `by_org_slug` index).
type SlugTable = "roles" | "roleFamilies"

// A short, url-safe id derived from a v4 uuid. No new dependency: crypto is
// available in the Convex runtime (already used in assessment/starters.ts).
// Used as a slug fallback when a name has no slug-able characters and as a
// last-resort uniqueness suffix.
function shortId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8)
}

// Generate a slug unique within the org for a slug-routed table. slugify the
// source name; fall back to a short id when it has no slug-able characters.
// On a per-org collision (the same name legitimately exists elsewhere, e.g. a
// role title shared across two families), prefer a readable prefixed form
// `${prefix}-${base}` (the family slug for a role) before resorting to a
// short-id suffix. `excludeId` skips the row itself so a rename keeps its slug.
export async function uniqueSlug(
  ctx: MutationCtx,
  table: SlugTable,
  orgId: string,
  source: string,
  opts: { excludeId?: Id<SlugTable>; prefix?: string } = {}
): Promise<string> {
  const isTaken = async (slug: string): Promise<boolean> => {
    // Branch on the concrete table name so the by_org_slug index (and its
    // compound eq range) resolves; a union table arg loses the index typing.
    const hit =
      table === "roles"
        ? await ctx.db
            .query("roles")
            .withIndex("by_org_slug", (q) =>
              q.eq("orgId", orgId).eq("slug", slug)
            )
            .first()
        : await ctx.db
            .query("roleFamilies")
            .withIndex("by_org_slug", (q) =>
              q.eq("orgId", orgId).eq("slug", slug)
            )
            .first()
    return hit !== null && hit._id !== opts.excludeId
  }

  const base = slugify(source) || shortId()
  if (!(await isTaken(base))) return base

  const prefix = opts.prefix ?? ""
  if (prefix !== "") {
    const prefixed = `${prefix}-${base}`
    if (!(await isTaken(prefixed))) return prefixed
  }

  // Last resort: a short-id suffix on the most readable stem available.
  const stem = prefix !== "" ? `${prefix}-${base}` : base
  let candidate = `${stem}-${shortId()}`
  while (await isTaken(candidate)) candidate = `${stem}-${shortId()}`
  return candidate
}
