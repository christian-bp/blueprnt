"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { useAction } from "convex/react"
import type { FunctionArgs } from "convex/server"
import { useState } from "react"

// Which surface a prefill run is attributed to, taken from the action's own
// args so the client cannot invent a value the audit detail has no label for.
type PrefillVia = FunctionArgs<typeof api.ai.prefill.prefillRoleProfiles>["via"]

export interface PrefillProgress {
  done: number
  total: number
}

// Live prefill progress derived from listRoles: how many of the measured roles
// already report a complete profile. As each prefill chunk's applyPrefill
// commits, listRoles re-runs and `done` climbs, so a progress bar advances
// reactively with no extra backend plumbing.
//
// `scopeIds` narrows the measurement to one import's roles. The total then
// comes from the scope rather than from the reported roles, so a role the
// query has not caught up with yet still counts toward the denominator instead
// of making the bar jump.
export function prefillProgressOf(
  roles: { roleId: Id<"roles">; profileComplete: boolean }[] | undefined,
  scopeIds?: Id<"roles">[]
): PrefillProgress {
  const all = roles ?? []
  if (scopeIds === undefined) {
    return {
      total: all.length,
      done: all.filter((role) => role.profileComplete).length,
    }
  }
  const scope = new Set<string>(scopeIds.map((id) => id as string))
  return {
    total: scopeIds.length,
    done: all.filter(
      (role) => scope.has(role.roleId as string) && role.profileComplete
    ).length,
  }
}

export interface ProfilePrefill {
  // True across the prefill await, and only when the caller said there was
  // something to draft. Drives the dedicated prefilling screen. Every run
  // ASSIGNS the flag from its own `willPrefill` rather than only raising it, so
  // a run with nothing to draft cannot inherit a previous run's true: a second
  // run in the same mounted hook would otherwise open on the prefilling screen
  // and never leave it. It is still not cleared on success (onboarding
  // navigates away from the screen, and the in-app wizard gates its phase on
  // its own `pending` flag), so nothing flashes the previous screen.
  prefilling: boolean
  // Runs the prefill plus one best-effort retry when a batch partially failed.
  // Resolves on success and on a swallowed retry failure; rejects only on a
  // hard/transport error, after clearing `prefilling` so the caller returns to
  // its own screen with an error.
  run: (args: {
    locale: string
    willPrefill: boolean
    roleIds?: Id<"roles">[]
  }) => Promise<void>
}

// The shared post-persist prefill span. The action itself skips roles that
// already have a profile, so an unchanged set costs no model call; `roleIds`
// narrows it further to exactly the roles one import created, so an in-app
// import never drafts profiles for unrelated empty roles.
export function useProfilePrefill(options: {
  orgId: string
  // The surface running the prefill. Fixed per hook instance rather than per
  // run: it is the calling screen's identity, and it is written verbatim into
  // every role.updated audit row the run produces. Required, so a new surface
  // does not compile until it has chosen how its rows read.
  via: PrefillVia
}): ProfilePrefill {
  const { orgId, via } = options
  const prefillRoleProfiles = useAction(api.ai.prefill.prefillRoleProfiles)
  const [prefilling, setPrefilling] = useState(false)

  return {
    prefilling,
    run: async ({ locale, willPrefill, roleIds }) => {
      setPrefilling(willPrefill)
      // Convex distinguishes an omitted key from an explicit undefined, so the
      // optional scope is spread in rather than set to undefined.
      const args = {
        orgId,
        locale,
        via,
        ...(roleIds !== undefined ? { roleIds } : {}),
      }
      let failed: number
      try {
        const result = await prefillRoleProfiles(args)
        failed = result.failed
      } catch (error) {
        setPrefilling(false)
        throw error
      }
      // A partial failure (one batched call hit a rate limit or timeout) leaves
      // some roles empty but does not throw. One best-effort retry: the action
      // re-targets only the still-empty roles, so nothing already generated is
      // regenerated. A second miss must not block the caller, so this is
      // swallowed and the manual per-role draft stays the final fallback.
      if (failed > 0) {
        try {
          await prefillRoleProfiles(args)
        } catch {
          // Best effort only.
        }
      }
    },
  }
}
