import { PayMappingReview } from "@/components/pay-mapping/pay-mapping-review"

// Full-screen takeover, like the people import (app/(app)/people/import/page.tsx)
// and the onboarding wizard. WizardShell is a h-svh frame, so inside the app
// shell's padded content column it gets squished; a fixed, full-viewport layer
// lets it fill the screen and cover the sidebar/header (z-10/z-20). It stays
// inside the [slug] layout's React tree, so the wizard's steps keep the run
// context (usePayMappingRun) the [slug] layout's shell already resolved. Exit
// is the wizard's own control (the shell nav is hidden here), navigating back
// to the run's summary at the sibling /analysis route; there is no discard
// dialog because every step autosaves as the user goes. overflow-hidden clips
// any sub-pixel svh/inset mismatch; the wizard's own <main> handles internal
// scrolling via WizardShell.
export default function PayMappingReviewPage() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <PayMappingReview />
    </div>
  )
}
