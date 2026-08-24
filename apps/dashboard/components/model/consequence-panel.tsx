"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type { GenderDominance } from "@workspace/backend/convex/evaluationModel/consequence"
import { zoneContent } from "@workspace/backend/convex/evaluationModel/zoneContent"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import Link from "next/link"
import { HelpMorphButton } from "@/components/help-morph-button"
import { CARD_READING_MEASURE } from "@/components/model/approval-card"
import { zoneHeading } from "@/lib/zone-bands"

// The masterdokument's section 18, on the chapter where it decides something:
// what approving this method would do to the placements the organization
// already has, before anyone approves it.
//
// SILENT unless it has something to say. No buffer (the model has never been
// approved) and nothing to compare; nothing moves and there is nothing to
// warn about. A panel that appeared on every visit to say "no change" would
// be the standing framing prose the surface laws forbid, and worse, it would
// train the reader to skip the one visit where it matters.
//
// A TOTAL map, so a fifth gender class cannot compile until it has words. The
// if/else chain this replaces ended in an `else` that swallowed any unknown
// value into "nobody assigned", which is the quietest possible way to be wrong
// about someone's gender.
const GENDER_LABELS = {
  women: "genderWomen",
  men: "genderMen",
  mixed: "genderMixed",
  unstaffed: "genderUnstaffed",
} as const satisfies Record<GenderDominance, string>

// Numbers, not a chart. The comparison is four zones times two columns and a
// short list of roles; a chart here would be a chart project (the chart laws
// govern geometry, hover, legend and marks in full) for a table that reads
// perfectly well as a table. Worth revisiting as polish, never as v1.
export function ConsequencePanel({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.consequence")
  const tHelp = useTranslations("dashboard.help")
  const tLevels = useTranslations("dashboard.levels")
  const locale = useLocale()
  const analysis = useQuery(
    api.evaluationModel.consequence.getConsequenceAnalysis,
    { orgId }
  )

  // Loading is silence too: this panel is an interruption by design, and a
  // skeleton for a section that usually renders nothing would announce a
  // consequence before knowing there is one.
  if (analysis === undefined || !analysis.comparable) return null
  // Silence means "approving changes nothing", and a role falling off the
  // ladder is not nothing. That used to be invisible here, but the fix belongs
  // upstream and is there now: `moved` counts every placement that CHANGED,
  // and a role that loses or gains its level is a change, so it is a mover
  // with a null side. Adding `+ losing + gaining` to this gate would be a
  // branch no input can reach, which is the dead defensive code this file was
  // already corrected for once.
  if (analysis.moved === 0) return null

  const content = zoneContent(locale)
  const hidden = analysis.moved - analysis.movers.length
  const shifting = analysis.moved - analysis.losing - analysis.gaining

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("heading")}
          <HelpMorphButton label={tHelp("consequenceLabel")}>
            {tHelp("consequenceBody")}
          </HelpMorphButton>
        </CardTitle>
      </CardHeader>
      <CardContent className={`space-y-6 ${CARD_READING_MEASURE}`}>
        <div className="space-y-1">
          {/* Only the roles that move BETWEEN levels. `losing` and `gaining`
              are movers too (a role that leaves the ladder has changed), so
              counting them here as well made this sentence argue with the two
              below it: one role, "would move to another level" and "would lose
              its level". The three now partition the movers. */}
          {shifting > 0 && (
            <p className="text-sm leading-relaxed">
              {t("summary", { moved: shifting, placed: analysis.placed })}
            </p>
          )}
          {/* Its own sentence, not a number folded into the one above: "moved
              to another level" and "has no level any more" are different
              things to tell an approver, and the second is the one that needs
              acting on. */}
          {analysis.losing > 0 && (
            <p className="text-sm leading-relaxed">
              {t("losing", { count: analysis.losing })}
            </p>
          )}
          {analysis.gaining > 0 && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("gaining", { count: analysis.gaining })}
            </p>
          )}
          {analysis.criteriaAdded + analysis.criteriaRemoved > 0 && (
            // Why the placements move at all: the criteria set itself changed,
            // which is a different kind of change from a reweighting and the
            // reader should not have to infer it from the numbers.
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t("criteriaChanged", {
                added: analysis.criteriaAdded,
                removed: analysis.criteriaRemoved,
              })}
            </p>
          )}
        </div>

        <section className="space-y-2">
          <h3 className="font-medium text-sm">{t("distributionHeading")}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs">
                <th scope="col" className="w-1/2 text-left font-medium">
                  {/* Named for a screen reader; the zone rows below carry the
                      column's meaning visually. */}
                  <span className="sr-only">{t("zoneColumn")}</span>
                </th>
                <th scope="col" className="text-right font-medium">
                  {t("zoneApproved")}
                </th>
                <th scope="col" className="text-right font-medium">
                  {t("zoneNow")}
                </th>
              </tr>
            </thead>
            <tbody>
              {analysis.distribution.map((entry) => (
                <tr key={entry.zone}>
                  <th scope="row" className="py-1 text-left font-normal">
                    {zoneHeading(
                      tLevels("zoneLabel", { zone: entry.zone }),
                      content.zones[entry.zone].name
                    )}
                  </th>
                  <td className="py-1 text-right tabular-nums">
                    {entry.approved}
                  </td>
                  <td className="py-1 text-right tabular-nums">{entry.now}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="space-y-2">
          <h3 className="font-medium text-sm">{t("moversHeading")}</h3>
          <ul className="space-y-1">
            {analysis.movers.map((mover) => (
              <li
                key={mover.roleId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
              >
                <Link
                  href={`/roles/${mover.slug}`}
                  className="truncate underline-offset-4 hover:underline"
                >
                  {mover.title}
                </Link>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {/* Narrowed by the checks themselves rather than by a
                      `?? 0` default, which would have rendered "Level 0 to
                      none" for a level that does not exist. A mover always has
                      at least one side (the query skips a role placeable on
                      neither), so the last branch is unreachable and renders
                      nothing rather than a number nobody has. */}
                  {mover.from !== null && mover.to !== null
                    ? t("moverChange", { from: mover.from, to: mover.to })
                    : mover.from !== null
                      ? t("moverLoses", { from: mover.from })
                      : mover.to !== null
                        ? t("moverGains", { to: mover.to })
                        : null}
                </span>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            // The count stays exact even when the list is capped: how many
            // roles move is the number the approver is deciding on.
            <p className="text-muted-foreground text-sm">
              {t("moreMovers", { count: hidden })}
            </p>
          )}
        </section>

        <GroupShifts
          heading={t("familiesHeading")}
          rows={analysis.families.map((group) => ({
            ...group,
            // Two different situations arrive here as a null label, and only
            // ONE of them is "these roles have no family": the other is a
            // family whose name lookup missed. Both read as "No family" once,
            // which reported roles that HAVE a family under the bucket for
            // roles that do not. The empty key is the genuine bucket (the
            // backend groups familyless roles under ""), so a null label on
            // any other key is a lookup that failed, and says so rather than
            // borrowing the other row's meaning. The id itself never renders.
            name:
              group.label ??
              (group.key === "" ? t("noFamily") : t("unknownFamily")),
          }))}
        />
        {/* Counts per gender make-up, never a mark: this is a table of
            numbers, and the gender-mark law governs MARKS. Drawing one here
            would pull in hue, shape and legend for a column of integers. */}
        <GroupShifts
          heading={t("gendersHeading")}
          rows={analysis.genders.map((group) => ({
            ...group,
            name: t(GENDER_LABELS[group.key]),
          }))}
        />
      </CardContent>
    </Card>
  )
}

function GroupShifts({
  heading,
  rows,
}: {
  heading: string
  rows: {
    key: string
    name: string
    moved: number
    up: number
    down: number
    total: number
  }[]
}) {
  const t = useTranslations("dashboard.model.consequence")
  // A group where nothing moves says nothing: the table is about the change.
  const shifting = rows.filter((row) => row.moved > 0)
  if (shifting.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="font-medium text-sm">{heading}</h3>
      <ul className="space-y-1">
        {shifting.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
          >
            <span className="truncate">{row.name}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {/* A group whose roles all left or joined the ladder moved in no
                  DIRECTION, and "(0 up, 0 down)" beside "1 of 3 moves" reads
                  as a contradiction rather than as the directionless change it
                  is. The count stands alone there. */}
              {row.up + row.down === 0
                ? t("groupMoved", { moved: row.moved, total: row.total })
                : `${t("groupMoved", {
                    moved: row.moved,
                    total: row.total,
                  })} (${t("groupUp", { count: row.up })}, ${t("groupDown", {
                    count: row.down,
                  })})`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
