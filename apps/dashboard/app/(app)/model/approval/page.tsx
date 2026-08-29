"use client"

import { useTranslations } from "next-intl"
import dynamic from "next/dynamic"
import { ApprovalCard } from "@/components/model/approval-card"
import { ConsequencePanel } from "@/components/model/consequence-panel"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 4 of the model section: the ten-check gate and the approval
// itself (ADR-0023). Approval is the sole precondition for rating a role, and
// a method-affecting change anywhere in the section falls the model back to
// draft, which is why this is a chapter of its own rather than a footer on the
// method page. The working-conditions materiality DECISION is made on the
// Kriterier chapter; what this chapter carries is the check row reporting
// it. No help on the framing line: the approval concept's explainer sits on
// the card's own title.
// Loaded on demand: @react-pdf/renderer is the app's heaviest client
// dependency, and the export is one button pressed rarely.
const MethodAppendixDownload = dynamic(
  () =>
    import("@/components/pdf/method-appendix-download").then(
      (m) => m.MethodAppendixDownload
    ),
  { ssr: false }
)

export default function ModelApprovalChapterPage() {
  const { orgId } = useOrganization()
  const tChapters = useTranslations("dashboard.model.chapters")
  usePageTitle(tChapters("approval"))

  return (
    <div className="space-y-4">
      {/* The card takes the page's width, like every other chapter's content:
          a frame stopping halfway across leaves the right half of the chapter
          empty for no reason. The reading MEASURE is capped inside the card
          instead (approval-card.tsx), where it belongs: it is the checklist's
          text that must not run the width of a monitor, not the frame around
          it, and the status row wants the full width so its action can sit at
          the card's own edge. */}
      {/* Section 18 first, above the gate: the consequence of approving is
          what the approver is deciding on, and a summary below the Approve
          button is a summary nobody reads before pressing it. Silent unless
          approving would actually move something. */}
      <ConsequencePanel orgId={orgId} />
      {/* The metodbilaga as a surface of its own: the appendix is the
          evidence document of exactly what approving certifies, so its card
          (name, status, export) lives on the gate's chapter rather than as a
          stray button on Metod. */}
      <MethodAppendixDownload orgId={orgId} />
      <ApprovalCard orgId={orgId} />
    </div>
  )
}
