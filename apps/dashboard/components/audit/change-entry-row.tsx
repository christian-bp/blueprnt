import { ChangeArrow } from "@/components/change-arrow"
import type { changeEntries } from "@/lib/audit-detail"

// One shared key/value grid for every block in a detail sheet (the meta block
// and each change group), so they all read the same way: label left, value
// right, on a fixed-width key column that keeps values aligned across blocks.
// Shared by the org and admin audit sheets.
export const KV_GRID = "grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2.5 text-sm"

// One before/after row, shared by the org and admin audit detail sheets (and,
// in the org sheet, by each bulk item's nested list). Namespace-agnostic: it
// takes plain strings rather than a scoped translator, so any caller passes its
// own localized labels. A complex (object/array) value renders its compact JSON
// in a horizontally scrollable mono block so the sheet body never scrolls
// sideways; a scalar shows "from [→] to" (struck old, ChangeArrow icon) or just
// the new value.
export function ChangeEntryRow({
  entry,
  emptyLabel,
  clearedNote,
}: {
  entry: ReturnType<typeof changeEntries>[number]
  // Shown for a value cleared to "" (the "to" side is empty), e.g. "Empty".
  emptyLabel: string
  // When present, rendered as the muted note below the value (e.g. a field
  // cleared as a side effect of a rename). Absent means no note.
  clearedNote?: string
}) {
  return (
    <li className="px-3 py-2.5 text-sm">
      <div className="text-muted-foreground text-xs">{entry.label}</div>
      <div className="mt-0.5">
        {entry.isComplex ? (
          <pre className="overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
            {entry.isSet ? (
              entry.to
            ) : (
              <>
                {entry.from}
                {"\n"}
                <ChangeArrow className="mx-0 mr-1" />
                {entry.to}
              </>
            )}
          </pre>
        ) : entry.isSet ? (
          <span className="break-words">{entry.to}</span>
        ) : (
          <span className="break-words">
            <span className="text-muted-foreground line-through">
              {entry.from}
            </span>
            <ChangeArrow />
            {entry.to.trim() === "" ? (
              <span className="text-muted-foreground italic">{emptyLabel}</span>
            ) : (
              entry.to
            )}
          </span>
        )}
      </div>
      {clearedNote ? (
        <div className="mt-1 text-muted-foreground text-xs">{clearedNote}</div>
      ) : null}
    </li>
  )
}
