"use client"

import { toast as toastManager } from "@workspace/ui/components/toast"

// The app's toast API over the Base UI toast manager. Call sites pass an
// already-translated message; the `type` (which selects the status icon) and
// the announcement priority are mapped here once rather than repeated at every
// CRUD surface. Errors are announced urgently, successes politely.
export const toast = {
  success: (title: string) => toastManager.add({ title, type: "success" }),
  error: (title: string) =>
    toastManager.add({ title, type: "error", priority: "high" }),
}
