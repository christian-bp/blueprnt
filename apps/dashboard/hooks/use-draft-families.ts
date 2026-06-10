"use client"

import { useState } from "react"
import { cleanDraftFamilies, type DraftFamily } from "@/lib/family-dnd"

export interface SeedFamily {
  name: string
  roles: { title: string; trackKey: string }[]
}

// Owns the families step's editable draft list: the families, the unique id
// counter (ids must stay unique across all families and roles for dnd and
// React keys), seeding from a source (industry template or AI proposal), and
// the cleaned payload the create mutations accept. The list invariants live
// here, next to the dnd list operations in lib/family-dnd.
export function useDraftFamilies(): {
  families: DraftFamily[] | null
  seed: (
    source: SeedFamily[],
    mapTrackKey?: (trackKey: string) => string
  ) => void
  update: (updater: (current: DraftFamily[]) => DraftFamily[]) => void
  clear: () => void
  claimId: () => number
  cleaned: () => SeedFamily[]
} {
  const [families, setFamilies] = useState<DraftFamily[] | null>(null)
  const [nextId, setNextId] = useState(0)

  return {
    families,
    seed: (source, mapTrackKey = (trackKey) => trackKey) => {
      let id = 0
      setFamilies(
        source.map((family) => ({
          id: id++,
          name: family.name,
          roles: family.roles.map((role) => ({
            id: id++,
            title: role.title,
            trackKey: mapTrackKey(role.trackKey),
          })),
        }))
      )
      setNextId(id)
    },
    update: (updater) => setFamilies((current) => updater(current ?? [])),
    clear: () => {
      setFamilies(null)
      setNextId(0)
    },
    claimId: () => {
      const id = nextId
      setNextId(id + 1)
      return id
    },
    cleaned: () => cleanDraftFamilies(families ?? []),
  }
}
