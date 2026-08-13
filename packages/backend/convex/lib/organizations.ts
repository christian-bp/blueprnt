import { components } from "../_generated/api"
import type { QueryCtx } from "../_generated/server"

// Org id -> display name, for every org in the installation. Better Auth is
// the authoritative source for org identity (the app `organizations` table
// holds settings only, never the name), so every platform surface that joins
// an orgId to a display name reads it from here rather than re-deriving it.
export async function orgNameMap(ctx: QueryCtx): Promise<Map<string, string>> {
  const orgs = await ctx.runQuery(
    components.betterAuth.provisioning.listAllOrganizations,
    {}
  )
  return new Map(orgs.map((o) => [o.orgId, o.name]))
}
