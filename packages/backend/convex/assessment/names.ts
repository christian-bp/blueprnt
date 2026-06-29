import type { QueryCtx } from "../_generated/server"
import { clampLocale } from "../evaluationModel/localize"
import {
  TRACK_KEYS,
  templateContent,
} from "../evaluationModel/standardTemplate"

export type TrackNames = Map<
  string,
  { key: string; name: string; order: number }
>

// Localized track name lookup keyed by the stable track key. Tracks are
// fixed V1 constants (ADR-0006), so this is a pure content lookup with no
// database read. Shared by the role register and the results queries so the
// localization rule cannot drift between readers.
export function trackNames(locale: string | undefined): TrackNames {
  const content = templateContent(clampLocale(locale))
  return new Map(
    TRACK_KEYS.map((key, index) => [
      key as string,
      { key, name: content.trackNames[key], order: index + 1 },
    ])
  )
}

// Family lookup for the org, keyed by family id: the user-entered name (stored
// as written, no localization) plus the URL slug. Callers read `.name` for
// display and `.slug` to build family route links.
export async function familyNames(
  ctx: QueryCtx,
  orgId: string
): Promise<Map<string, { name: string; slug: string }>> {
  const families = await ctx.db
    .query("roleFamilies")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect()
  return new Map(
    families.map((family) => [
      family._id as string,
      { name: family.name, slug: family.slug },
    ])
  )
}
