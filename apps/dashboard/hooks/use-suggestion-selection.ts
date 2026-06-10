"use client"

import { useState } from "react"

// The seed-on-new-suggestion selection every confirm panel shares: when a
// NEW suggested row arrives (tracked by its id), the accepted set reseeds
// from seedItems; user toggles never reseed. State adjusts during render
// (the established pattern), re-running only when the suggestion id changes.
export function useSuggestionSelection<Item>(
  suggestionId: string | null,
  seedItems: () => Iterable<Item>
): {
  accepted: Set<Item>
  toggle: (item: Item, checked: boolean) => void
} {
  const [selection, setSelection] = useState<{
    seededFor: string | null
    accepted: Set<Item>
  }>({ seededFor: null, accepted: new Set() })

  if (suggestionId !== null && selection.seededFor !== suggestionId) {
    setSelection({ seededFor: suggestionId, accepted: new Set(seedItems()) })
  }

  return {
    accepted: selection.accepted,
    toggle: (item, checked) =>
      setSelection((current) => {
        const next = new Set(current.accepted)
        if (checked) next.add(item)
        else next.delete(item)
        return { seededFor: current.seededFor, accepted: next }
      }),
  }
}
