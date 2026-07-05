"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import { Table } from "@workspace/ui/components/table"
import { useMutation, useQuery } from "convex/react"
import { useLocale, useTranslations } from "next-intl"
import { useEffect, useRef } from "react"
import { PageHeader } from "@/components/page-header"
import { useOrganization } from "@/components/org-context"
import {
  CLASSIFY_SKELETON_COLUMNS,
  ClassifyTableHeader,
  ClassifyTitleTable,
} from "@/components/people/classify/classify-title-table"
import { TableSkeleton } from "@/components/table-skeleton"
import { usePageTitle } from "@/hooks/use-page-title"

// The Classify surface: shows each distinct job title found in the imported
// people, the engine's role suggestion + confidence, the current assignment
// state, and a Confirm action. HR reviews and confirms each title-to-role
// mapping; the engine's suggestion is a starting point, never auto-applied.
//
// On mount, runClassificationSuggestions runs once (idempotent per Plan 2) to
// materialise engine output for any newly imported titles; listPeopleByTitle
// re-runs reactively after the mutation writes, so the table populates without
// a separate refresh.
export default function ClassifyPage() {
  const t = useTranslations("dashboard.classify")
  usePageTitle(t("pageTitle"))

  const { orgId } = useOrganization()
  const locale = useLocale()

  const groups = useQuery(api.people.classificationQueries.listPeopleByTitle, {
    orgId,
  })
  const roles = useQuery(api.assessment.roles.listRoles, { orgId, locale })
  const model = useQuery(api.evaluationModel.model.getModel, { orgId, locale })
  const settings = useQuery(api.accounts.organization.getOrganizationSettings, {
    orgId,
  })

  // Fire-once effect: run the classification engine for any titles that do not
  // yet have a suggestion row. The mutation is idempotent; the ref prevents a
  // duplicate in-flight call on StrictMode double-invoke.
  const run = useMutation(
    api.people.classification.runClassificationSuggestions
  )
  const ranRef = useRef(false)
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    void run({ orgId })
  }, [run, orgId])

  // Show a skeleton shaped like the real table while any query is loading.
  // ClassifyTableHeader and CLASSIFY_SKELETON_COLUMNS are shared with the real
  // table so the two cannot drift independently; the per-column shapes mirror
  // the row's real controls (checkbox, chevron, select, badge, button) so the
  // silhouette and row height match the loaded state.
  if (
    groups === undefined ||
    roles === undefined ||
    model === undefined ||
    settings === undefined
  ) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("heading")} description={t("description")} />
        <Table>
          <ClassifyTableHeader />
          <TableSkeleton columns={CLASSIFY_SKELETON_COLUMNS} rows={5} />
        </Table>
      </div>
    )
  }

  // getModel can be null when the org has no model yet (pre-onboarding).
  // Treat missing model as empty tracks; the table still renders (roles are the
  // operative data for Select options).
  const tracks = model?.tracks ?? []

  return (
    <div className="space-y-4">
      <PageHeader title={t("heading")} description={t("description")} />
      <ClassifyTitleTable
        orgId={orgId}
        groups={groups}
        roles={roles}
        tracks={tracks}
        pseudonymize={settings.pseudonymizeNames}
      />
    </div>
  )
}
