import {
  LEVEL_COUNT,
  MIN_STEP_CEILING,
  MIN_STEP_FLOOR,
  SCORE_SCALE_MAX,
  ZONE_KEYS,
} from "@workspace/core"
import { z } from "zod"
import type { ValidationT } from "@/lib/validation"

// Client gate for the level-rules form.
//
// The BACKEND is the authority: updateLevelRules and updateZoneProfileRules
// each re-run the engine's own check (levelRulesValid, zoneProfileMonotonic)
// and refuse with invalidInput. What this does is say the same truths in words
// BEFORE the save, on the field that broke them, because "the engine refused"
// arriving as one line under the button tells a reader nothing about which of
// twelve numbers is wrong.
//
// It encodes exactly the engine's rules and invents none of its own:
//   - twelve levels, numbered 1..12 (LEVEL_COUNT, never a literal here);
//   - a strictly DECREASING minScore as the level number rises, since level 1
//     is the highest and each level starts where the one below it stops;
//   - level 12 opens at 0, so every role places somewhere;
//   - level 1 never opens above 100, the scale's own ceiling;
//   - zone minSteps never rise as the zones descend A -> D: a lower zone may
//     not be gated harder than a higher one.

export interface LevelRulesMessages {
  decreasing: string
  bottomZero: string
  zoneMonotonic: string
  range: string
}

export function makeLevelRulesSchema(
  t: ValidationT,
  messages: LevelRulesMessages
) {
  const minScore = z
    .number({ message: t("required") })
    .int(messages.range)
    .min(0, messages.range)
    .max(SCORE_SCALE_MAX, messages.range)

  const minStep = z
    .number()
    .int(messages.range)
    .min(MIN_STEP_FLOOR, messages.range)
    .max(MIN_STEP_CEILING, messages.range)
    .optional()

  return z
    .object({
      // Fixed length: the architecture is twelve levels and the form never
      // offers to add or drop one, so a shorter array is a bug rather than a
      // user error.
      levels: z.array(minScore).length(LEVEL_COUNT),
      zones: z.object(
        Object.fromEntries(ZONE_KEYS.map((zone) => [zone, minStep])) as Record<
          (typeof ZONE_KEYS)[number],
          typeof minStep
        >
      ),
    })
    .superRefine((values, ctx) => {
      // Reported on the field that BREAKS the rule, not on the form: a reader
      // with one wrong number should see it marked, not be told the ladder is
      // invalid.
      for (const [index, score] of values.levels.entries()) {
        const previous = values.levels[index - 1]
        if (previous !== undefined && score >= previous) {
          ctx.addIssue({
            code: "custom",
            path: ["levels", index],
            message: messages.decreasing,
          })
        }
      }
      // No ceiling check here. The field schema above already caps every entry
      // at SCORE_SCALE_MAX and Zod skips superRefine when the base object
      // fails, so a branch on levels[0] > SCORE_SCALE_MAX could never fire.
      const last = values.levels[LEVEL_COUNT - 1]
      if (last !== undefined && last !== 0) {
        ctx.addIssue({
          code: "custom",
          path: ["levels", LEVEL_COUNT - 1],
          message: messages.bottomZero,
        })
      }
      // Walking A -> D: a configured zone may not ask MORE than a zone above
      // it. Zones with no rule are skipped, exactly as the engine skips them.
      let previous: number | undefined
      for (const zone of ZONE_KEYS) {
        const step = values.zones[zone]
        if (step === undefined) continue
        if (previous !== undefined && step > previous) {
          ctx.addIssue({
            code: "custom",
            path: ["zones", zone],
            message: messages.zoneMonotonic,
          })
        }
        previous = step
      }
    })
}

export type LevelRulesValues = z.infer<ReturnType<typeof makeLevelRulesSchema>>
