"use client"

import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useState } from "react"
import {
  cleanDraftFamilies,
  cleanDraftFamiliesWithIds,
  type DraftFamily,
} from "@/lib/family-dnd"

// A seed source: the create paths (template/AI) pass families without ids; the
// resume-from-existing path also carries the real familyId/roleId so the draft
// can reconcile against the stored set instead of re-creating it.
export interface SeedFamily {
  familyId?: Id<"roleFamilies">
  name: string
  roles: { roleId?: Id<"roles">; title: string; trackKey: string }[]
}

// The reconcileStarterSet payload shape: like SeedFamily but with the ids made
// explicit (omitted when undefined so the validator's v.optional is satisfied).
export interface ReconcileFamily {
  familyId?: Id<"roleFamilies">
  name: string
  roles: { roleId?: Id<"roles">; title: string; trackKey: string }[]
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
  cleanedWithIds: () => ReconcileFamily[]
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
          // Carry the real ids through (undefined for template/AI seeds).
          ...(family.familyId !== undefined
            ? { familyId: family.familyId }
            : {}),
          name: family.name,
          roles: family.roles.map((role) => ({
            id: id++,
            ...(role.roleId !== undefined ? { roleId: role.roleId } : {}),
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
    // The create paths drop the ids (createStarterSet/confirmStarterImport
    // only take name/title/trackKey); the reconcile path keeps them so the
    // server can diff against the stored set.
    cleaned: () => cleanDraftFamilies(families ?? []),
    cleanedWithIds: () => cleanDraftFamiliesWithIds(families ?? []),
  }
}
