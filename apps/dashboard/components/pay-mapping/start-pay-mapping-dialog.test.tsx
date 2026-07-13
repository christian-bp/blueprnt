import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const startPayMappingRunMock = vi.fn()
const pushMock = vi.fn()

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "payMapping.runs.startPayMappingRun")
      return startPayMappingRunMock
    return vi.fn()
  },
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    payMapping: {
      runs: {
        startPayMappingRun: "payMapping.runs.startPayMappingRun",
      },
    },
  },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}))

import { toast } from "sonner"
import { StartPayMappingDialog } from "@/components/pay-mapping/start-pay-mapping-dialog"

const labels = messages.dashboard.payMapping.start
const triggerLabel = messages.dashboard.payMapping.startCta

function renderDialog() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <StartPayMappingDialog orgId="org-1" triggerLabel={triggerLabel} />
    </NextIntlClientProvider>
  )
}

describe("StartPayMappingDialog", () => {
  beforeEach(() => {
    startPayMappingRunMock.mockReset()
    pushMock.mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => {
    cleanup()
  })

  it("blocks submit until the label is filled in", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: triggerLabel }))
    const submit = screen.getByRole("button", {
      name: labels.cta,
    }) as HTMLButtonElement
    // Empty by default: the label is required, so the gate stays closed.
    expect(submit.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText(labels.labelLabel), {
      target: { value: "Lonekartlaggning 2026" },
    })
    await waitFor(() => {
      expect(submit.disabled).toBe(false)
    })
  })

  it("shows a required error and never calls the server when submitted empty", async () => {
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: triggerLabel }))
    const form = screen
      .getByLabelText(labels.labelLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)
    await waitFor(() => {
      expect(
        screen.getAllByText(messages.dashboard.validation.required).length
      ).toBeGreaterThan(0)
    })
    expect(startPayMappingRunMock).not.toHaveBeenCalled()
  })

  it("submits the label, toasts, and navigates to the new run's slug", async () => {
    startPayMappingRunMock.mockResolvedValue({
      runId: "run-new",
      slug: "lonekartlaggning-2026",
    })
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: triggerLabel }))
    fireEvent.change(screen.getByLabelText(labels.labelLabel), {
      target: { value: "Lonekartlaggning 2026" },
    })
    const form = screen
      .getByLabelText(labels.labelLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(startPayMappingRunMock).toHaveBeenCalledWith({
        orgId: "org-1",
        label: "Lonekartlaggning 2026",
      })
    })
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        "/pay-mappings/lonekartlaggning-2026"
      )
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.payMappingStarted
    )
  })

  it("keeps the dialog open and shows an error when the server call fails", async () => {
    startPayMappingRunMock.mockRejectedValue(new Error("boom"))
    renderDialog()
    fireEvent.click(screen.getByRole("button", { name: triggerLabel }))
    fireEvent.change(screen.getByLabelText(labels.labelLabel), {
      target: { value: "Lonekartlaggning 2026" },
    })
    const form = screen
      .getByLabelText(labels.labelLabel)
      .closest("form") as HTMLFormElement
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined()
    })
    expect(screen.getByLabelText(labels.labelLabel)).toBeDefined()
  })
})
