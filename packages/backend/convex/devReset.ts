import { v } from "convex/values"
import type { TableNames } from "./_generated/dataModel"
import { internalMutation } from "./_generated/server"

// Dev-only database wipe. This mutation is internal and never internet-exposed,
// but it must ONLY ever be reached via seed:resetDatabase, the "use node" action
// that carries the SITE_URL-localhost guard. Do not call it from any other path
// and never expose it publicly: it unconditionally deletes every app-side row.

// Every table declared in convex/schema.ts. `satisfies` keeps this list honest:
// adding a table to the schema without listing it here is a type error.
const APP_TABLES = [
  "users",
  "organizations",
  "auditLog",
  "models",
  "criteria",
  "roles",
  "ratings",
  "roleFamilies",
  "suggestions",
] as const satisfies readonly TableNames[]

// Delete at most this many rows per table per invocation so a single mutation
// stays under Convex's per-transaction write limit. The caller (resetDatabase)
// loops until done; dev-scale data finishes in one pass.
const PAGE_SIZE = 500

export const wipeAppTables = internalMutation({
  args: {},
  returns: v.object({ done: v.boolean() }),
  handler: async (ctx) => {
    let truncated = false
    for (const table of APP_TABLES) {
      const rows = await ctx.db.query(table).take(PAGE_SIZE)
      for (const row of rows) {
        await ctx.db.delete(row._id)
      }
      // A full page means there may be more rows in this table; keep looping.
      if (rows.length === PAGE_SIZE) {
        truncated = true
      }
    }
    return { done: !truncated }
  },
})
