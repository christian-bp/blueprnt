"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { api } from "@workspace/backend/convex/_generated/api"
import {
  LEVEL_COUNT,
  MIN_STEP_CEILING,
  MIN_STEP_FLOOR,
  SCORE_SCALE_MAX,
  ZONE_KEYS,
  type ZoneKey,
} from "@workspace/core"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@workspace/ui/components/form"
import { Input } from "@workspace/ui/components/input"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { HelpMorphButton } from "@/components/help-morph-button"
import { SettingsFrame, SettingsRow } from "@/components/settings-frame"
import { SubmitButton } from "@/components/submit-button"
import { newGestureId } from "@/lib/gesture"
import {
  type LevelRulesValues,
  makeLevelRulesSchema,
} from "@/lib/level-rules-schemas"
import { numberInputField } from "@/lib/number-field"
import { zoneHeading, zoneLevels } from "@/lib/zone-bands"
import { toast } from "@/lib/toast"

// The level thresholds and the zone profile rules, readable and correctable.
//
// Both mutations have existed since ADR-0022 and nothing called them: an org
// could see where its roles landed and had no way to say the ladder was wrong.
// This is the smallest surface that closes that, and deliberately no more than
// the mutations accept: twelve minScores and up to four minSteps. It offers no
// way to add or remove a level, because the twelve-level architecture is
// structural law and not configuration (ADR-0022).
//
// ONE form over TWO mutations, each fired only when its own half changed: an
// unchanged half would still write an audit row and reopen the approval for a
// change nobody made. They share a gesture id, so the rows they write read as
// one story in the log.
// No frame `description`. It stated the same two facts, clause for clause in
// the same order, that the help body on the title beside it states, that the
// two settings rows below it state in more useful detail, and that the
// footer's reopensApproval sentence closes with: four tellings of one thing.
// A standing sentence restating what the reader is already looking at is the
// framing prose the surface laws name as a defect, and the help popover is
// where that depth belongs, opt-in rather than always on.
export function LevelRulesPanel({
  orgId,
  onSaved,
}: {
  orgId: string
  // Fired after a save lands. Saving reopens the approval, which makes the
  // consequence panel at the TOP of the chapter go from silent to speaking:
  // the chapter grows a card above the reader, who is at the bottom looking at
  // the button they just pressed. The panel does not scroll itself, because the
  // thing worth showing is not this panel; the chapter owns the target.
  onSaved?: () => void
}) {
  const locale = useLocale()
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  if (model === undefined) return <LevelRulesSkeleton />
  if (model === null) return null
  return (
    <LevelRulesForm
      orgId={orgId}
      onSaved={onSaved}
      // Keyed on the stored values, so an edit landing from elsewhere (a
      // restore, another operator) re-seeds the form instead of leaving the
      // reader typing into a stale ladder.
      key={JSON.stringify([model.levelRules, model.zoneProfileRules])}
      levelRules={model.levelRules}
      zoneProfileRules={model.zoneProfileRules}
    />
  )
}

function LevelRulesForm({
  orgId,
  levelRules,
  zoneProfileRules,
  onSaved,
}: {
  orgId: string
  levelRules: readonly { level: number; minScore: number }[]
  zoneProfileRules: readonly { zone: ZoneKey; minStep: number }[]
  onSaved?: () => void
}) {
  const t = useTranslations("dashboard.model.levelRules")
  const tHelp = useTranslations("dashboard.help")
  const tLevels = useTranslations("dashboard.levels")
  const tToast = useTranslations("dashboard.toast")
  const tv = useTranslations("dashboard.validation")
  const locale = useLocale()
  const content = zoneContent(locale)
  const saveLevels = useMutation(api.evaluationModel.approval.updateLevelRules)
  const saveZones = useMutation(
    api.evaluationModel.approval.updateZoneProfileRules
  )

  const byLevel = new Map(levelRules.map((rule) => [rule.level, rule.minScore]))
  const byZone = new Map(
    zoneProfileRules.map((rule) => [rule.zone, rule.minStep])
  )
  const defaults: LevelRulesValues = {
    levels: Array.from(
      { length: LEVEL_COUNT },
      (_, index) => byLevel.get(index + 1) ?? 0
    ),
    zones: Object.fromEntries(
      ZONE_KEYS.map((zone) => [zone, byZone.get(zone)])
    ) as LevelRulesValues["zones"],
  }

  const schema = useMemo(
    () =>
      makeLevelRulesSchema(tv, {
        decreasing: tv("levelDecreasing"),
        bottomZero: tv("levelBottomZero"),
        zoneMonotonic: tv("zoneMonotonic"),
        range: tv("scoreRange"),
      }),
    [tv]
  )
  const form = useForm<LevelRulesValues>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: defaults,
  })
  const { isDirty, isValid, isSubmitting, dirtyFields } = form.formState

  async function handleValid(values: LevelRulesValues) {
    const gestureId = newGestureId()
    try {
      if (dirtyFields.levels !== undefined) {
        await saveLevels({
          orgId,
          gestureId,
          levelRules: values.levels.map((minScore, index) => ({
            level: index + 1,
            minScore,
          })),
        })
      }
      if (dirtyFields.zones !== undefined) {
        await saveZones({
          orgId,
          gestureId,
          // A zone left empty carries no rule, exactly as the engine reads it:
          // it is gated on the weighting alone rather than at step 0.
          zoneProfileRules: ZONE_KEYS.flatMap((zone) => {
            const minStep = values.zones[zone]
            return minStep === undefined ? [] : [{ zone, minStep }]
          }),
        })
      }
      toast.success(tToast("thresholdsSaved"))
      form.reset(values)
      onSaved?.()
    } catch {
      // The backend re-runs the engine's own check and refuses with
      // invalidInput; the client schema encodes the same truths, so reaching
      // here means the two disagree about something. Said on the form rather
      // than on a field, because we no longer know which field it was.
      form.setError("root", { message: t("invalid") })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleValid)}>
        <SettingsFrame
          title={
            <span className="flex items-center gap-2">
              {t("title")}
              <HelpMorphButton label={tHelp("levelThresholdLabel")}>
                {tHelp("levelThresholdBody")}
              </HelpMorphButton>
            </span>
          }
          footer={
            <div className="flex flex-wrap items-center justify-end gap-3">
              {/* The precondition in words, beside the act rather than after
                  it: editing thresholds is method-affecting, so saving falls
                  the model back to draft and the checklist has to be signed
                  again. A reader should know that before pressing, not from
                  the approval card changing under them. */}
              <p className="max-w-md text-muted-foreground text-sm leading-relaxed">
                {t("reopensApproval")}
              </p>
              <SubmitButton
                type="submit"
                isSubmitting={isSubmitting}
                disabled={!isValid || !isDirty}
              >
                {t("save")}
              </SubmitButton>
            </div>
          }
        >
          <SettingsRow
            label={t("levelsLabel")}
            description={t("levelsDescription")}
          >
            {/* Grouped by zone, in the zones' own words: twelve bare numbers
                are a column of digits, and the reader who is correcting them
                is thinking in zones (task 1's content, task 2's ladder). */}
            <div className="space-y-3">
              {ZONE_KEYS.map((zone) => (
                <div key={zone} className="space-y-1.5">
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {zoneHeading(
                      tLevels("zoneLabel", { zone }),
                      content.zones[zone].name
                    )}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {zoneLevels(zone).map((level) => (
                      <FormField
                        key={level}
                        control={form.control}
                        name={`levels.${level - 1}` as const}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-muted-foreground text-xs">
                              {t("levelField", { level })}
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                inputMode="numeric"
                                min={0}
                                max={SCORE_SCALE_MAX}
                                className="tabular-nums"
                                {...numberInputField(field)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SettingsRow>

          <SettingsRow
            label={t("zonesLabel")}
            description={t("zonesDescription")}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ZONE_KEYS.map((zone) => (
                <FormField
                  key={zone}
                  control={form.control}
                  name={`zones.${zone}` as const}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground text-xs">
                        {t("zoneField", { zone })}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={MIN_STEP_FLOOR}
                          max={MIN_STEP_CEILING}
                          className="tabular-nums"
                          {...numberInputField(field)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
          </SettingsRow>
          {form.formState.errors.root?.message !== undefined && (
            <div className="px-5 py-4">
              <p role="alert" className="text-destructive text-sm">
                {form.formState.errors.root.message}
              </p>
            </div>
          )}
        </SettingsFrame>
      </form>
    </Form>
  )
}

// The loading state, on the REAL anatomy.
//
// Everything here that is static i18n text or structural law is rendered for
// real: the title and its help, both row labels, the four zone names, the
// reopens-approval sentence and the Save button. Bars stand in only for the
// numbers, which are the one thing unknown until the query answers. The
// previous version drew the title and the labels as bars and left out the
// second row and the whole footer, so the panel grew by a settings row and a
// button row on arrival, which is the reflow a skeleton exists to prevent.
function LevelRulesSkeleton() {
  const t = useTranslations("dashboard.model.levelRules")
  const tHelp = useTranslations("dashboard.help")
  const tLevels = useTranslations("dashboard.levels")
  const locale = useLocale()
  const content = zoneContent(locale)
  return (
    <SettingsFrame
      title={
        <span className="flex items-center gap-2">
          {t("title")}
          <HelpMorphButton label={tHelp("levelThresholdLabel")}>
            {tHelp("levelThresholdBody")}
          </HelpMorphButton>
        </span>
      }
      footer={
        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="max-w-md text-muted-foreground text-sm leading-relaxed">
            {t("reopensApproval")}
          </p>
          {/* Disabled, because the loaded form's own initial state is
              disabled: an enabled Save that flipped to disabled on arrival
              would be a control that changes under the reader. */}
          <SubmitButton type="button" isSubmitting={false} disabled>
            {t("save")}
          </SubmitButton>
        </div>
      }
    >
      <SettingsRow
        label={t("levelsLabel")}
        description={t("levelsDescription")}
      >
        <div className="space-y-3">
          {ZONE_KEYS.map((zone) => (
            <div key={zone} className="space-y-1.5">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {zoneHeading(
                  tLevels("zoneLabel", { zone }),
                  content.zones[zone].name
                )}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {zoneLevels(zone).map((level) => (
                  // Input-height, so the row measures as it will once the
                  // numbers arrive.
                  <Skeleton key={level} className="h-9 w-full" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SettingsRow>
      <SettingsRow label={t("zonesLabel")} description={t("zonesDescription")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ZONE_KEYS.map((zone) => (
            <Skeleton key={zone} className="h-9 w-full" />
          ))}
        </div>
      </SettingsRow>
    </SettingsFrame>
  )
}
