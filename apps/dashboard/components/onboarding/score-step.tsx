"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Button } from "@workspace/ui/components/button"
import { Spinner } from "@workspace/ui/components/spinner"
import { useMutation, useQuery } from "convex/react"
import { AnimatePresence, motion } from "motion/react"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { HelpMorphButton } from "@/components/help-morph-button"
import { OptionCard } from "@/components/onboarding/option-card"
import { ScoreRole } from "@/components/onboarding/score-role"
import { ScreenShell } from "@/components/onboarding/screen-shell"
import { groupRowsByFamily } from "@/lib/group-roles-by-family"

// The final onboarding step: opt-in scoring with a save-and-exit escape on
// every path. The fork screen shows only when no role is started; otherwise
// it lands on the scoring list. Reaching this step and leaving it by any
// path (later, save and exit, all complete) completes onboarding, which is
// what flips the gate to the dashboard. Score/band are derived and never
// stored (ADR-0002); this step writes nothing but the per-criterion ratings
// and the profile fields (in ScoreRole), then calls completeOnboarding.
export function ScoreStep({
  orgId,
  onFinish,
}: {
  orgId: string
  // The wizard's finish callback: hands control back to the onboarding gate.
  onFinish: () => void
}) {
  const t = useTranslations("dashboard.onboarding.score")
  const tOnboarding = useTranslations("dashboard.onboarding")
  const tHelp = useTranslations("dashboard.help")
  const locale = useLocale()
  const results = useQuery(api.assessment.results.getResults, { orgId, locale })
  // listRoles carries per-role profileComplete; getResults sees ratings only,
  // so anyStarted reads from here to count a drafted profile as engagement.
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const completeOnboarding = useMutation(
    api.accounts.organization.completeOnboarding
  )

  // The user explicitly chose to score now (or no fork was needed). The fork
  // is skipped once any role has been started.
  const [scoring, setScoring] = useState(false)
  // Which fork card is chosen, so the other one fades (the model-choice
  // pattern). "now" flips to the list; "later" runs exit().
  const [picked, setPicked] = useState<"now" | "later" | null>(null)
  // The role currently open in the per-role view, or null for the list.
  const [openRoleId, setOpenRoleId] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)

  // Every exit path runs through here: complete onboarding, then finish.
  async function exit() {
    if (exiting) return
    setExiting(true)
    try {
      await completeOnboarding({ orgId })
      onFinish()
    } catch {
      // completeOnboarding is idempotent and the gate stays on this step on
      // failure; re-enable the control so the user can retry.
      setExiting(false)
    }
  }

  if (results === undefined || roles === undefined) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner aria-label={tOnboarding("loading")} />
      </div>
    )
  }

  const rows = results.rows
  const total = rows.length
  const scored = rows.filter((row) => row.complete).length
  // "Started" = any role has a filled profile OR at least one rating. Derived
  // from listRoles (which exposes profileComplete) rather than getResults
  // (ratings only), so drafting a profile and returning to this step does not
  // reopen the fork. The fork only gates the very first entry into scoring.
  const anyStarted = roles.some(
    (role) => role.profileComplete || role.ratedCount > 0
  )
  const allComplete = total > 0 && scored === total

  // Phase selection. mode="wait" opacity crossfade reuses the wizard frame's
  // animation language; no height/layout animation (docs/ui-animation.md).
  const phase =
    openRoleId !== null
      ? "role"
      : allComplete
        ? "done"
        : scoring || anyStarted
          ? "list"
          : "fork"

  // Group the scoring list by role family (header-only): families A-Z, any
  // family-less roles under a trailing "Other roles" header. With no families
  // at all the list renders flat, exactly as before.
  const roleGroups = groupRowsByFamily(rows, locale)
  const hasFamilies = roleGroups.some((group) => group.familyName !== null)

  function renderRoleRow(row: (typeof rows)[number]) {
    return (
      <li
        key={row.roleId}
        className="flex items-center justify-between gap-3 rounded-md border p-3"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{row.title}</p>
        </div>
        {row.complete ? (
          <span className="text-muted-foreground text-sm">
            {t("roleDoneLabel")}
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpenRoleId(row.roleId)}
          >
            {row.ratedCount > 0 ? t("resumeRoleCta") : t("scoreRoleCta")}
          </Button>
        )}
      </li>
    )
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={phase}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {phase === "role" && openRoleId !== null ? (
          <ScoreRole
            orgId={orgId}
            roleId={openRoleId}
            onDone={() => setOpenRoleId(null)}
          />
        ) : phase === "fork" ? (
          <ScreenShell
            heading={t("forkHeading")}
            description={tHelp("onboardingScoreBody")}
          >
            <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
              <OptionCard
                title={t("scoreNowCta")}
                description={t("scoreNowDescription")}
                selected={picked === "now"}
                faded={picked === "later"}
                onSelect={() => {
                  setPicked("now")
                  setScoring(true)
                }}
              />
              <OptionCard
                title={t("laterCta")}
                description={t("laterDescription")}
                selected={picked === "later"}
                faded={picked === "now"}
                onSelect={() => {
                  if (exiting) return
                  setPicked("later")
                  exit()
                }}
              />
            </div>
          </ScreenShell>
        ) : phase === "done" ? (
          <ScreenShell heading={t("doneHeading")} description={t("doneBody")}>
            <Button type="button" disabled={exiting} onClick={() => exit()}>
              {t("doneCta")}
            </Button>
          </ScreenShell>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-medium text-lg">{t("rolesHeading")}</h2>
              <HelpMorphButton label={tHelp("onboardingScoreLabel")}>
                {tHelp("onboardingScoreBody")}
              </HelpMorphButton>
            </div>
            {/* Persistent reassurance line, in its own slot so opting in does
                not reflow the list below it. */}
            <p className="text-muted-foreground text-sm">{t("saveExitLine")}</p>
            {hasFamilies ? (
              <div className="space-y-5">
                {roleGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <h3 className="font-medium text-muted-foreground text-sm">
                      {group.familyName ?? t("ungroupedFamily")}
                    </h3>
                    <ul className="space-y-2">
                      {group.rows.map(renderRoleRow)}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-2">{rows.map(renderRoleRow)}</ul>
            )}
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={exiting}
                onClick={() => exit()}
              >
                {t("saveExitCta")}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
