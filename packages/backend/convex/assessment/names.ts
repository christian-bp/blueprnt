import type { QueryCtx } from "../_generated/server"
import {
  clampLocale,
  isLevelKey,
  isTrackKey,
} from "../evaluationModel/localize"
import { templateContent } from "../evaluationModel/standardTemplate"

export interface TrackLevelNames {
  trackName: Map<string, { key: string; name: string }>
  levelName: Map<string, { key: string; name: string }>
}

// Localized track/level name lookup for the org's model. Both seed paths
// write stable keys, so names localize by key with stored values as fallback
// (same rule as getModel). Shared by the role register and the results
// queries so the localization rule cannot drift between readers.
export async function trackLevelNames(
  ctx: QueryCtx,
  orgId: string,
  locale: string | undefined
): Promise<TrackLevelNames> {
  const content = templateContent(clampLocale(locale))
  const model = await ctx.db
    .query("models")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .unique()
  const trackName = new Map<string, { key: string; name: string }>()
  const levelName = new Map<string, { key: string; name: string }>()
  if (model === null) return { trackName, levelName }
  const tracks = await ctx.db
    .query("tracks")
    .withIndex("by_model", (q) => q.eq("modelId", model._id))
    .collect()
  for (const track of tracks) {
    trackName.set(track._id as string, {
      key: track.key,
      name: isTrackKey(track.key) ? content.trackNames[track.key] : track.name,
    })
    const levels = await ctx.db
      .query("levels")
      .withIndex("by_track", (q) => q.eq("trackId", track._id))
      .collect()
    for (const level of levels) {
      levelName.set(level._id as string, {
        key: level.key,
        name: isLevelKey(level.key)
          ? content.levelNames[level.key]
          : level.name,
      })
    }
  }
  return { trackName, levelName }
}
