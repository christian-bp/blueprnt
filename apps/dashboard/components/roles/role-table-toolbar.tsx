"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { useTranslations } from "next-intl"
import { TableSearchField } from "@/components/table-search-field"
import { onSelectValue } from "@/lib/select"

// Structural subset of getModel's tracks: neither role table needs convex
// types of its own (same precedent as CreateRoleDialog's TrackOption).
export interface RolesTableTrack {
  key: string
  name: string
}

// The track filter's all-option. A Base UI select always holds a value, so
// "no track filter" is this sentinel rather than an empty string.
export const ALL_TRACKS = "all"

// The toolbar shared by every role table (the register and a family page):
// free-text search + the track filter, with a result count that appears only
// while something narrows the table. One component so the surfaces search and
// filter identically, and so a loading toolbar can render the REAL controls
// with zero markup drift: omit the value/handler props and the search stays
// uncontrolled (it still takes keystrokes) while the filter shows its
// all-option until the tracks arrive.
export function RoleTableToolbar({
  tracks,
  query,
  onQueryChange,
  track = ALL_TRACKS,
  onTrackChange,
  shown,
  total,
}: {
  tracks: RolesTableTrack[]
  query?: string
  onQueryChange?: (query: string) => void
  track?: string
  onTrackChange?: (track: string) => void
  shown?: number
  total?: number
}) {
  const t = useTranslations("dashboard.roles")
  const tToolbar = useTranslations("dashboard.roles.toolbar")

  const filtersActive = (query ?? "").trim() !== "" || track !== ALL_TRACKS

  return (
    <div className="flex flex-wrap items-center gap-2">
      <TableSearchField
        placeholder={tToolbar("searchPlaceholder")}
        value={query}
        onChange={onQueryChange}
      />
      <Select
        items={{
          [ALL_TRACKS]: tToolbar("trackAll"),
          ...Object.fromEntries(tracks.map((entry) => [entry.key, entry.name])),
        }}
        value={track}
        onValueChange={onSelectValue<string>((value) => onTrackChange?.(value))}
      >
        <SelectTrigger aria-label={t("table.track")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_TRACKS}>{tToolbar("trackAll")}</SelectItem>
          {tracks.map((entry) => (
            <SelectItem key={entry.key} value={entry.key}>
              {entry.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filtersActive && shown !== undefined && total !== undefined && (
        <span className="ml-auto text-muted-foreground text-sm tabular-nums">
          {tToolbar("resultCount", { shown, total })}
        </span>
      )}
    </div>
  )
}
