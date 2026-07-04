"use client"

import { TRACK_LEVELS, isValidLevelForTrack } from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { TableCell, TableRow } from "@workspace/ui/components/table"
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
// Component: renders one <TableRow> per person inside the expanded section.
// The parent mounts these inside an AnimatePresence / motion wrapper so the
// rows have no animation logic of their own (they are plain table rows).
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
          <TableRow
            key={person.personId}
            className="bg-muted/30"
            data-person-row
          >
            {/* Expand toggle placeholder column */}
            <TableCell />
            {/* Name */}
            <TableCell className="text-sm">{name}</TableCell>
            {/* Employment start date + tenure */}
            <TableCell className="text-muted-foreground text-sm">
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
            </TableCell>
            {/* Confidence placeholder */}
            <TableCell />
            {/* State placeholder */}
            <TableCell />
            {/* Level Select */}
            <TableCell>
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
            </TableCell>
          </TableRow>
        )
      })}
    </>
  )
}
