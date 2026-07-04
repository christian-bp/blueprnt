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
import { displayNameFor } from "@/lib/person-display"
import type { ClassifyPersonRow } from "./classify-title-table"

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
// Component: renders one block row per person inside the expanded section.
// The parent mounts these inside a motion.div that handles the height
// animation (see classify-title-table.tsx FIX 8). These are plain block
// divs, NOT table rows, because the animation requires a block container
// (a nested <Table> wraps itself in an overflow-x:auto scroll container
// that fights height:0 collapse). Layout mirrors the table columns with
// a simple CSS grid so person rows align visually as sub-rows of the
// title row.
// ---------------------------------------------------------------------------

export function ClassifyPersonRows({
  people,
  trackKey,
  selectedLevel,
  onLevelChange,
  pseudonymize,
}: ClassifyPersonRowsProps) {
  const t = useTranslations("dashboard.classify")
  const tOrg = useTranslations("dashboard.organization.general")

  // Capture today once per render for tenure computation (display-only;
  // new Date() is acceptable in a client component per the task brief).
  const today = new Date()

  const trackLevels = (
    TRACK_LEVELS[trackKey as keyof typeof TRACK_LEVELS] ?? []
  ).filter((l) => isValidLevelForTrack(trackKey, l))

  return (
    <>
      {people.map((person) => {
        // Default the level to the person's suggestedLevel when it is valid
        // for this track, otherwise fall back to the first level in the track.
        const defaultLevel =
          person.suggestedLevel !== null &&
          isValidLevelForTrack(trackKey, person.suggestedLevel)
            ? person.suggestedLevel
            : (trackLevels[0] ?? "")

        const currentLevel = selectedLevel.get(person.personId) ?? defaultLevel

        const name = displayNameFor(person, pseudonymize, (ref) =>
          tOrg("pseudonymTemplate", { ref })
        )

        const tenure = tenureYears(person.employmentStartDate, today)

        return (
          // Block grid row: 8 columns matching the outer table's column count.
          // pl-8 indents past the expand-toggle slot; the level select aligns
          // with the outer Level column (col 7, index 6).
          <div
            key={person.personId}
            data-person-row
            className="grid grid-cols-[2rem_1fr_1fr_1fr_auto_auto_8rem_auto] items-center gap-x-4 bg-muted/30 px-4 py-2 text-sm"
          >
            {/* Expand toggle placeholder */}
            <div />
            {/* Name */}
            <div className="font-normal">{name}</div>
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
            {/* Suggested role placeholder */}
            <div />
            {/* Confidence placeholder */}
            <div />
            {/* State placeholder */}
            <div />
            {/* Level Select */}
            <div>
              <Select
                value={currentLevel}
                onValueChange={(value) => onLevelChange(person.personId, value)}
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
            {/* Actions placeholder */}
            <div />
          </div>
        )
      })}
    </>
  )
}
