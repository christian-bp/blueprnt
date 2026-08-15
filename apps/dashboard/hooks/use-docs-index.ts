"use client"

import { useLocale } from "next-intl"
import { useEffect, useState } from "react"
import type { DocsIndex } from "@/lib/docs/docs-index"

// The guide index, fetched the first time it is actually needed. See
// app/api/docs-index/route.ts for why it arrives over a request instead of
// riding in every page's RSC payload.
//
// Module scope, not component state: the corpus is static for the life of the
// deployment, so once a locale is loaded it stays loaded for the session no
// matter how often the palette is opened and closed. The promise is cached so
// two callers mounting at once share one request.
const cachedIndexes = new Map<string, Promise<DocsIndex>>()

function loadDocsIndex(locale: string): Promise<DocsIndex> {
  const cached = cachedIndexes.get(locale)
  if (cached !== undefined) return cached
  const loading = fetch(`/api/docs-index?locale=${locale}`)
    .then((response) => {
      if (!response.ok) throw new Error(`docs index: ${response.status}`)
      return response.json() as Promise<DocsIndex>
    })
    .catch((error: unknown) => {
      // A dropped request must not disable the guides for the whole session:
      // forget it so the next open tries again.
      cachedIndexes.delete(locale)
      throw error
    })
  cachedIndexes.set(locale, loading)
  return loading
}

// Returns undefined until the index is available. `enabled` is what keeps the
// request from happening at all until the caller needs it; the palette passes
// its open state. The index follows the live UI language, so switching
// language while signed in re-fetches the guides in the new one.
export function useDocsIndex(enabled: boolean): DocsIndex | undefined {
  const locale = useLocale()
  const [index, setIndex] = useState<DocsIndex>()

  useEffect(() => {
    if (!enabled) return
    let canceled = false
    loadDocsIndex(locale).then(
      (loaded) => {
        if (!canceled) setIndex(loaded)
      },
      // The palette still lists every page without the guides, which is a
      // better answer than a broken dialog.
      () => {
        if (!canceled) setIndex([])
      }
    )
    return () => {
      canceled = true
    }
  }, [enabled, locale])

  return index
}
