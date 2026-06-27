"use client"

import { Button } from "@workspace/ui/components/button"
import { useState } from "react"
import { SuccessCheck } from "@/components/auth/success-check"

// Dev preview: eyeball the 2FA success badge and its animation without running
// the full 2FA setup flow. Replay remounts the badge to re-trigger the spring +
// ring pulse. Not auth-gated, so it works without a session. Hardcoded text is
// fine here: this is a dev-only page, removed before launch (tracked in
// docs/go-live-checklist.md).
export default function SuccessCheckPreviewPage() {
  const [replayKey, setReplayKey] = useState(0)
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-10 bg-background">
      <SuccessCheck key={replayKey} />
      <Button variant="outline" onClick={() => setReplayKey((k) => k + 1)}>
        Replay
      </Button>
    </main>
  )
}
