"use client"

import { PayMappingActionsOverview } from "@/components/pay-mapping/actions-overview"

// The Actions section: the run's action plan as its own workspace
// (Iteration 2 note 5, part B). Reachable straight from the run's tabs
// rather than through the analysis, since the follow-up work happens here
// long after the analysis itself is documented. The [slug] layout's shell
// resolves the run and its work layer; this page reads them from context.
export default function PayMappingActionsPage() {
  return <PayMappingActionsOverview />
}
