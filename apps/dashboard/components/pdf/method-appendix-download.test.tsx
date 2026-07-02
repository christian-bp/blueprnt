import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const toBlob = vi.fn(async () => new Blob(["x"], { type: "application/pdf" }))
vi.mock("@react-pdf/renderer", () => ({
  pdf: () => ({ toBlob }),
  StyleSheet: { create: (s: unknown) => s },
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
}))
vi.mock("convex/react", () => ({
  useQuery: () => ({
    modelName: "M",
    pointBudget: 6,
    bandThresholds: [],
    criteria: [
      {
        criterionId: "c1",
        name: "Scope",
        description: "",
        weightPoints: 3,
        share: 50,
        order: 1,
        purpose: "p",
        whyRelevant: "w",
        overlapNotes: null,
        biasRisk: "low",
        biasComment: "b",
        biasAction: null,
        status: "approved",
        decidedByName: "Alex",
        decidedAt: 1,
      },
    ],
    progress: { documented: 1, approved: 1, total: 1 },
  }),
}))

import { MethodAppendixDownload } from "@/components/pdf/method-appendix-download"

function renderDownload(orgId = "org1") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MethodAppendixDownload orgId={orgId} />
    </NextIntlClientProvider>
  )
}

describe("MethodAppendixDownload", () => {
  afterEach(() => {
    cleanup()
  })

  it("builds and downloads the PDF on click", async () => {
    globalThis.URL.createObjectURL = vi.fn(() => "blob:x")
    globalThis.URL.revokeObjectURL = vi.fn()
    renderDownload()
    fireEvent.click(screen.getByRole("button"))
    await waitFor(() => expect(toBlob).toHaveBeenCalled())
  })
})
