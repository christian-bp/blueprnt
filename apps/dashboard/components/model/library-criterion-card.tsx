"use client"

import { useDraggable } from "@dnd-kit/core"
import type { DimensionKey } from "@workspace/core"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import { useLocale, useTranslations } from "next-intl"
import { type LibraryDragData, libraryDraggableId } from "@/lib/builder-dnd"

// One criterion as the library offers it: everything the card needs is the
// selection content, never the org's own row (nothing here is selected yet).
export interface LibraryCardEntry {
  libraryKey: string
  dimensionKey: DimensionKey
  name: string
  shortUiText: string
}

// An unselected criterion in a dimension's library list, waiting to be pulled
// into the zone above it.
//
// Two routes in, both first-class: the body drags, and the Add button adds.
// The button is not a fallback for people who cannot drag, it is the faster
// route for everyone, so it is always visible rather than hidden behind a
// hover or a menu.
//
// The drag surface and the button are SIBLINGS rather than one inside the
// other. dnd-kit's draggable attributes make their element a button in the
// accessibility tree, and a button inside a button is not a thing a screen
// reader can describe: the two controls sit side by side instead, which is
// also how they read on screen.
export function LibraryCriterionCard({
  entry,
  recommended,
  overlapsSelected,
  dimmedReason,
  onAdd,
}: {
  entry: LibraryCardEntry
  // The org's industry hints point at this criterion. A hint, never a
  // selection: the company still chooses and documents its own criteria.
  recommended?: boolean
  // Names of already-selected criteria this one overlaps, from the library's
  // overlap map. Named rather than counted, because "overlaps something" is a
  // warning nobody can act on.
  overlapsSelected?: readonly string[]
  // Why this criterion cannot be added right now, in the caller's own words
  // (which cap bound is the caller's knowledge). Its presence closes BOTH
  // routes in, so the drag can never do what the button refuses.
  dimmedReason?: string
  onAdd: () => void
}) {
  const t = useTranslations("dashboard.model.build")
  const locale = useLocale()
  const blocked = dimmedReason !== undefined

  const data: LibraryDragData = {
    libraryKey: entry.libraryKey,
    dimensionKey: entry.dimensionKey,
  }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: libraryDraggableId(entry.libraryKey),
    data,
    disabled: blocked,
  })

  const overlaps = overlapsSelected ?? []

  return (
    <li className="rounded-md border bg-card p-3">
      <div
        className={cn(
          "flex items-start gap-2 transition-opacity motion-reduce:transition-none",
          // The card stays in place while it is dragged (the drag overlay is
          // the thing that moves), so it fades rather than leaving a gap that
          // would reflow the list under the pointer.
          isDragging && "opacity-40",
          // The dimming stops at the two controls. The sentence below explains
          // why they are closed, and an explanation faded to 60% on top of its
          // own muted ink is the one thing on the card that must stay legible.
          blocked && "opacity-60"
        )}
      >
        {/* The whole descriptive body is the drag surface, so the card is
            grabbed wherever the hand lands on it rather than on a handle the
            reader has to find.
            A real button, not a div wearing dnd-kit's role: the vendor's
            attributes make it one in the accessibility tree either way, and
            the element that says so in the markup is the one that gets the
            focus handling and the keyboard activation for free. It carries no
            onClick because pressing it IS the pick-up, which the keyboard
            sensor handles. */}
        <button
          ref={setNodeRef}
          type="button"
          aria-label={t("dragLabel", { name: entry.name })}
          className={cn(
            "min-w-0 flex-1 touch-none rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !blocked && "cursor-grab active:cursor-grabbing"
          )}
          {...attributes}
          {...listeners}
        >
          <span className="block truncate font-medium text-sm">
            {entry.name}
          </span>
          <span className="block text-muted-foreground text-xs">
            {entry.shortUiText}
          </span>
          {(recommended === true || overlaps.length > 0) && (
            <span className="mt-2 flex flex-wrap gap-1">
              {recommended === true && (
                <Badge variant="secondary">{t("recommendedChip")}</Badge>
              )}
              {overlaps.length > 0 && (
                // Badge ships one line high and clipped, which is right for a
                // status word and wrong for a chip naming two criteria in a
                // column this narrow: it would cut the second name off with no
                // ellipsis. Allowed to wrap here, and only here.
                <Badge variant="outline" className="h-auto whitespace-normal">
                  {t("overlapChip", {
                    // Joined by the locale's own list rules rather than a comma
                    // we picked: a criterion name can itself contain "and".
                    names: new Intl.ListFormat(locale, {
                      style: "short",
                      type: "conjunction",
                    }).format(overlaps),
                  })}
                </Badge>
              )}
            </span>
          )}
        </button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocked}
          // The page carries a dozen of these; "Add" alone would leave a screen
          // reader with a dozen identical buttons.
          aria-label={t("addLabel", { name: entry.name })}
          className="shrink-0"
          onClick={onAdd}
        >
          {t("addCta")}
        </Button>
      </div>
      {/* Below both controls rather than inside the draggable body: it is
          about the card, it needs the card's full width for a sentence, and a
          control's own subtree is not where an explanation of that control
          belongs. It extends the card downwards and moves nothing already on
          screen. */}
      {blocked && (
        <p className="mt-2 text-muted-foreground text-xs">{dimmedReason}</p>
      )}
    </li>
  )
}
