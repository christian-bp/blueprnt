"use client"

import { TRACK_LEVELS, isValidLevelForTrack } from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import { displayNameFor } from "@/lib/person-display"
import { type ClassifyPersonRow, resolveLevel } from "./classify-title-table"
import { onSelectValue } from "@/lib/select"

// ---------------------------------------------------------------------------
// Pure tenure helper: display-only, not engine logic. Captured once per
// component render (today is a parameter so tests can inject a fixed date).
// ---------------------------------------------------------------------------

export function tenureYears(
  startDate: string | null,
  today: Date
): number | null {
  if (startDate === null) return null
  const start = new Date(startDate)
  if (Number.isNaN(start.getTime())) return null
  const ms = today.getTime() - start.getTime()
  return Math.max(0, Math.floor(ms / (365.25 * 24 * 60 * 60 * 1000)))
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClassifyPersonRowsProps {
  people: ClassifyPersonRow[]
  trackKey: string
  // Map<personId, selectedLevel> - controlled by the parent
  selectedLevel: Map<string, string>
  onLevelChange: (personId: string, level: string) => void
  pseudonymize: boolean
}

// ---------------------------------------------------------------------------
// Component: the person list inside the expanded review panel, rendered as a
// bordered card (header row + divided person rows). The parent mounts it
// inside a motion.div that handles the height animation (see
// classify-title-table.tsx FIX 8). These are plain block divs, NOT table
// rows, because the animation requires a block container (a nested <Table>
// wraps itself in an overflow-x:auto scroll container that fights height:0
// collapse).
// ---------------------------------------------------------------------------

// The shared grid template: name, start date, and the level select.
const PERSON_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_minmax(8rem,13rem)] items-center gap-x-4 px-4"

export function ClassifyPersonRows({
  people,
  trackKey,
  selectedLevel,
  onLevelChange,
  pseudonymize,
}: ClassifyPersonRowsProps) {
  const t = useTranslations("dashboard.classify")
  const tHelp = useTranslations("dashboard.help")
  const tOrg = useTranslations("dashboard.organization.general")

  // Capture today once per render for tenure computation (display-only;
  // new Date() is acceptable in a client component per the task brief).
  const today = new Date()

  const trackLevels = (
    TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS] ?? []
  ).filter((l) => isValidLevelForTrack(trackKey, l))

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Header line for the person rows: names the columns and carries the
          level concept's help where levels are shown. */}
      <div
        className={`${PERSON_GRID} border-b bg-muted/50 py-2 font-medium text-muted-foreground text-xs`}
      >
        <div>{t("personColumns.name")}</div>
        <div>{t("personColumns.startDate")}</div>
        <div>
          <span className="flex items-center gap-1.5">
            {t("levelLabel")}
            {/* ONE HelpMorphButton per concept, placed where the concept is
                used: the per-person level selects below. */}
            <HelpMorphButton label={tHelp("classifyLevelLabel")}>
              {tHelp("classifyLevelBody")}
            </HelpMorphButton>
          </span>
        </div>
      </div>
      <div className="divide-y">
        {people.map((person) => {
          // Default the level via the shared resolveLevel priority (current
          // assigned level, then suggestion, then the track's first level) so
          // what the select shows equals what buildAssignments would submit.
          const currentLevel =
            selectedLevel.get(person.personId) ?? resolveLevel(person, trackKey)

          const name = displayNameFor(person, pseudonymize, (ref) =>
            tOrg("pseudonymTemplate", { ref })
          )

          const tenure = tenureYears(person.employmentStartDate, today)

          return (
            <div
              key={person.personId}
              data-person-row
              className={`${PERSON_GRID} py-2 text-sm`}
            >
              {/* Name */}
              <div className="truncate">{name}</div>
              {/* Employment start date + tenure */}
              <div className="text-muted-foreground">
                {person.employmentStartDate !== null ? (
                  <span>
                    {person.employmentStartDate}
                    {tenure !== null && (
                      <span className="ml-1.5 text-xs">
                        ({t("tenureYears", { years: tenure })})
                      </span>
                    )}
                  </span>
                ) : null}
              </div>
              {/* Level Select */}
              <div>
                <Select
                  value={currentLevel}
                  onValueChange={onSelectValue((value: string) =>
                    onLevelChange(person.personId, value)
                  )}
                >
                  <SelectTrigger aria-label={t("levelLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {trackLevels.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
