"use client"

import { api } from "@workspace/backend/convex/_generated/api"
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
// Numbers, not a chart. The comparison is four zones times two columns and a
// short list of roles; a chart here would be a chart project (the chart laws
// govern geometry, hover, legend and marks in full) for a table that reads
// perfectly well as a table. Worth revisiting as polish, never as v1.
export function ConsequencePanel({ orgId }: { orgId: string }) {
  const t = useTranslations("dashboard.model.consequence")
  const tHelp = useTranslations("dashboard.help")
  const locale = useLocale()
  const analysis = useQuery(
    api.evaluationModel.consequence.getConsequenceAnalysis,
    { orgId }
  )

  // Loading is silence too: this panel is an interruption by design, and a
  // skeleton for a section that usually renders nothing would announce a
  // consequence before knowing there is one.
  if (analysis === undefined || !analysis.comparable) return null
  if (analysis.moved === 0) return null

  const content = zoneContent(locale)
  const hidden = analysis.moved - analysis.movers.length

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
          <p className="text-sm leading-relaxed">
            {t("summary", {
              moved: analysis.moved,
              placed: analysis.placed,
            })}
          </p>
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
                <th scope="col" className="w-1/2 text-left font-medium" />
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
                    {`${entry.zone}. ${content.zones[entry.zone].name}`}
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
                  {t("moverChange", { from: mover.from, to: mover.to })}
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
            name: group.label ?? t("noFamily"),
          }))}
        />
        {/* Counts per gender make-up, never a mark: this is a table of
            numbers, and the gender-mark law governs MARKS. Drawing one here
            would pull in hue, shape and legend for a column of integers. */}
        <GroupShifts
          heading={t("gendersHeading")}
          rows={analysis.genders.map((group) => ({
            ...group,
            name: t(
              group.key === "women"
                ? "genderWomen"
                : group.key === "men"
                  ? "genderMen"
                  : group.key === "mixed"
                    ? "genderMixed"
                    : "genderUnstaffed"
            ),
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
              {`${t("groupMoved", { moved: row.moved, total: row.total })} (${t(
                "groupUp",
                { count: row.up }
              )}, ${t("groupDown", { count: row.down })})`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
