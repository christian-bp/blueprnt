"use client"

import { ModelEditor } from "@/components/model/model-editor"
import { useOrganization } from "@/components/org-context"

// The evaluation model page: the shared criteria editor plus the AI
// importance review. Band thresholds and deeper E2 editing come later.
export default function ModelPage() {
  const { orgId } = useOrganization()
  return <ModelEditor orgId={orgId} withAiReview />
}
