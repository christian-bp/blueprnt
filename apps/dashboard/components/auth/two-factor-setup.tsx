"use client"

// Placeholder; the full setup wizard is implemented in the next task. The gate
// only relies on the onConfirmed prop and on getMyMfaStatus flipping reactively
// after confirmMfaSetup runs.
export function TwoFactorSetup({ onConfirmed }: { onConfirmed: () => void }) {
  void onConfirmed
  return null
}
