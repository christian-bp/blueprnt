"use client"

import { useReducedMotion } from "motion/react"
import { useTranslations } from "next-intl"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { ChapterAction } from "@/components/chapter-action-slot"
import { ApprovalCard } from "@/components/model/approval-card"
import { ConsequencePanel } from "@/components/model/consequence-panel"
import { LevelRulesPanel } from "@/components/model/level-rules-panel"
import { useOrganization } from "@/components/org-context"
import { usePageTitle } from "@/hooks/use-page-title"

// Chapter 4 of the model section: the twelve-check gate and the approval
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

  // A threshold save reopens the approval, so the consequence panel above goes
  // from silent to speaking and everything on screen moves down by a card
  // while the reader is at the bottom of the chapter. Rather than reorder the
  // chapter (the consequence belongs immediately above Approve, and cause
  // before consequence is not worth the gate reading last), the shift becomes
  // a deliberate NAVIGATION: the answer to "what did I just do" is put in
  // front of the person who did it.
  const consequenceRef = useRef<HTMLDivElement>(null)
  const [savedCount, setSavedCount] = useState(0)
  const onSaved = useCallback(() => setSavedCount((n) => n + 1), [])
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    if (savedCount === 0) return
    const node = consequenceRef.current
    if (node === null) return
    // One frame, so the panel the mutation just made speak is committed
    // before we aim at it. Under reduced motion this is an instant jump: the
    // navigation still happens, the travel does not.
    const frame = requestAnimationFrame(() => {
      node.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      })
    })
    return () => cancelAnimationFrame(frame)
  }, [savedCount, reduceMotion])

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
      <div ref={consequenceRef}>
        <ConsequencePanel orgId={orgId} />
      </div>
      {/* The metodbilaga export is the approval chapter's own action: the
          appendix is the evidence document of exactly what approving
          certifies, so it exports from the gate rather than from the Metod
          chapter that writes one part of it. Lands in the section's closing
          row. */}
      <ChapterAction>
        <MethodAppendixDownload orgId={orgId} />
      </ChapterAction>
      <ApprovalCard orgId={orgId} />
      {/* The thresholds under the gate they belong to: they are part of what
          approval certifies, so the surface that edits them sits with the
          approval and says, beside its own save, that saving reopens it. */}
      <LevelRulesPanel orgId={orgId} onSaved={onSaved} />
    </div>
  )
}
