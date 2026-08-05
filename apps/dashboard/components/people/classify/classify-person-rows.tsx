"use client"

import {
  TRACK_SENIORITIES,
  isValidSeniorityForTrack,
} from "@workspace/constants"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useTranslations } from "next-intl"
import { HelpMorphButton } from "@/components/help-morph-button"
import {
  type ClassifyPersonRow,
  resolveSeniority,
} from "./classify-title-table"
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
  // Map<personId, selectedSeniority> - controlled by the parent
  selectedSeniority: Map<string, string>
  onSeniorityChange: (personId: string, seniority: string) => void
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

// The shared grid template: name, start date, and the seniority select.
const PERSON_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(9rem,12rem)_minmax(8rem,13rem)] items-center gap-x-4 px-4"

export function ClassifyPersonRows({
  people,
  trackKey,
  selectedSeniority,
  onSeniorityChange,
}: ClassifyPersonRowsProps) {
  const t = useTranslations("dashboard.classify")
  const tHelp = useTranslations("dashboard.help")

  // Capture today once per render for tenure computation (display-only;
  // new Date() is acceptable in a client component per the task brief).
  const today = new Date()

  const trackSeniorities = (
    TRACK_SENIORITIES[trackKey as keyof typeof TRACK_SENIORITIES] ?? []
  ).filter((l) => isValidSeniorityForTrack(trackKey, l))

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {/* Header line for the person rows: names the columns and carries the
          seniority concept's help where seniorities are shown. */}
      <div
        className={`${PERSON_GRID} border-b bg-muted/50 py-2 font-medium text-muted-foreground text-xs`}
      >
        <div>{t("personColumns.name")}</div>
        <div>{t("personColumns.startDate")}</div>
        <div>
          <span className="flex items-center gap-1.5">
            {t("seniorityLabel")}
            {/* ONE HelpMorphButton per concept, placed where the concept is
                used: the per-person seniority selects below. */}
            <HelpMorphButton label={tHelp("classifySeniorityLabel")}>
              {tHelp("classifySeniorityBody")}
            </HelpMorphButton>
          </span>
        </div>
      </div>
      <div className="divide-y">
        {people.map((person) => {
          // Default the seniority via the shared resolveSeniority priority
          // (current assigned seniority, then suggestion, then the track's
          // first seniority) so what the select shows equals what
          // buildAssignments would submit.
          const currentSeniority =
            selectedSeniority.get(person.personId) ??
            resolveSeniority(person, trackKey)

          const name = person.displayName

          const tenure = tenureYears(person.employmentStartDate, today)

          return (
            <div
              key={person.personId}
              data-person-row
              // Row hover ties the seniority select to its person across the
              // wide gap (same tint as table-row hover).
              className={`${PERSON_GRID} py-2 text-sm transition-colors hover:bg-muted/50`}
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
              {/* Seniority Select. Without a resolved role there is no track
                  and no seniorities: the select stays full-size but disabled,
                  and the placeholder states the precondition in words
                  (guidance convention) instead of collapsing to an empty
                  control. */}
              <div>
                <Select
                  value={currentSeniority}
                  onValueChange={onSelectValue((value: string) =>
                    onSeniorityChange(person.personId, value)
                  )}
                  disabled={trackSeniorities.length === 0}
                >
                  <SelectTrigger
                    aria-label={t("seniorityLabel")}
                    className="w-full"
                  >
                    <SelectValue placeholder={t("seniorityNeedsRole")} />
                  </SelectTrigger>
                  <SelectContent>
                    {trackSeniorities.map((seniority) => (
                      <SelectItem key={seniority} value={seniority}>
                        {seniority}
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
