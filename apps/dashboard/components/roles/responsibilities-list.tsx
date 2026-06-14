import { cn } from "@workspace/ui/lib/utils"

// Responsibilities are stored as one responsibility per line (newline
// separated); this renders that read-only contract as a real bulleted list.
// The marker strip is defensive: a stored line may already start with a bullet
// or number (e.g. pasted from a doc), so we drop a single leading "- ", "* ",
// "• ", "1. ", or "1) " to avoid a double bullet. The marker must be followed
// by whitespace or be digits plus a dot/paren, so "e-mail" and "3 reports"
// stay intact.
const LIST_MARKER = /^\s*(?:[-*•·]|\d+[.)])\s+/

export function ResponsibilitiesList({
  value,
  id,
  // The host controls text emphasis: the read-only profile shows full-contrast
  // text, the AI draft preview passes text-muted-foreground to match its other
  // (still draft) field rows.
  className,
}: {
  value: string
  id?: string
  className?: string
}) {
  // Lines have no stable id and may repeat, so derive a unique key from the
  // text plus its occurrence count (avoids a bare array index as the key).
  const seen = new Map<string, number>()
  const items = value
    .split(/\r?\n/)
    .map((line) => line.trim().replace(LIST_MARKER, ""))
    .filter((line) => line.length > 0)
    .map((text) => {
      const occurrence = seen.get(text) ?? 0
      seen.set(text, occurrence + 1)
      return { key: `${text}#${occurrence}`, text }
    })

  if (items.length === 0) return null

  return (
    <ul id={id} className={cn("list-disc space-y-1 pl-5 text-sm", className)}>
      {items.map((item) => (
        <li key={item.key}>{item.text}</li>
      ))}
    </ul>
  )
}
