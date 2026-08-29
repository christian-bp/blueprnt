import { v } from "convex/values"
import { internalMutation } from "../_generated/server"

// One-shot data migrations for the evaluation model. Each one exists to let a
// narrowed schema land on a deployment that still holds documents written
// against the wider one, and each is deleted together with the transitional
// validator fields it was written to clear (evaluationModel/tables.ts).
//
// Written as internalMutation, not a seed action: this runs against
// deployments that hold real data, so it carries no localhost guard and no
// wipe. It only removes fields the engine has already stopped reading.

// ADR-0024 made the twelve level thresholds and the zone profile requirements
// method law in packages/core, so no organization carries a copy any more. A
// model document written before that still holds them in two places, its own
// top level and inside the lastApprovedModel restore buffer, and the narrowed
// validator refuses the whole document at push time.
//
// Removing them loses nothing: the engine reads LEVEL_RULES and
// ZONE_PROFILE_RULES directly, and the buffer's copies could only ever restore
// the model to a ladder that no longer exists as a stored thing. A frozen
// pay-mapping run is deliberately NOT touched: its own copies are the
// statutory evidence of what that run measured, they are declared explicitly
// on payMappingRuns.frozenModel rather than tolerated, and they stay.
//
// Bounded by design: there is exactly one model document per organization, so
// this collects a table whose size is the customer count. It is idempotent, so
// a re-run after a partial failure finishes the rest, and it reports what it
// touched rather than returning null, because the operator running it against
// production needs to see that the number matches what they expected.
export const dropRetiredLevelRules = internalMutation({
  args: {},
  returns: v.object({
    scanned: v.number(),
    cleared: v.number(),
    buffersCleared: v.number(),
  }),
  handler: async (ctx) => {
    const models = await ctx.db.query("models").collect()
    let cleared = 0
    let buffersCleared = 0
    for (const model of models) {
      // The stored document is read through the transitional validator, so
      // these are typed as optional rather than unknown.
      const hasOwn =
        model.levelRules !== undefined || model.zoneProfileRules !== undefined
      const buffer = model.lastApprovedModel
      const hasBuffer =
        buffer !== undefined &&
        (buffer.levelRules !== undefined ||
          buffer.zoneProfileRules !== undefined)
      if (!hasOwn && !hasBuffer) continue

      // Patching a field to undefined removes it. The buffer has to be
      // rewritten whole rather than patched into, since patch merges one level
      // deep and would leave the nested fields in place.
      const patch: {
        levelRules?: undefined
        zoneProfileRules?: undefined
        lastApprovedModel?: typeof buffer
      } = {}
      if (hasOwn) {
        patch.levelRules = undefined
        patch.zoneProfileRules = undefined
        cleared += 1
      }
      if (hasBuffer && buffer !== undefined) {
        const { levelRules: _l, zoneProfileRules: _z, ...rest } = buffer
        patch.lastApprovedModel = rest
        buffersCleared += 1
      }
      await ctx.db.patch(model._id, patch)
    }
    return { scanned: models.length, cleared, buffersCleared }
  },
})
