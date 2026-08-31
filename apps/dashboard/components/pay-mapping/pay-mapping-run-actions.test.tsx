import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { toast } from "@/lib/toast"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const deleteRunMock = vi.fn()
// One-shot query answers for the row-menu download, keyed by the api ref
// marker; the export hook itself is mocked, so the assertion is about WHAT
// data the menu hands it.
const RUN_DETAIL = {
  runId: "run-1",
  label: "Lonekartlaggning 2026",
  referenceDate: 100,
}
const GAP = { currency: "SEK" }
const queryMock = vi.fn(async (ref: unknown) => {
  if (ref === "runs.getBySlug") return RUN_DETAIL
  if (ref === "gap.get") return GAP
  if (ref === "runs.list") return []
  return []
})

vi.mock("convex/react", () => ({
  useMutation: (ref: unknown) => {
    if (ref === "payMapping.runs.deletePayMappingRun") return deleteRunMock
    return vi.fn()
  },
  useConvex: () => ({ query: queryMock }),
}))

vi.mock("@workspace/backend/convex/_generated/api", () => ({
  api: {
    payMapping: {
      runs: {
        deletePayMappingRun: "payMapping.runs.deletePayMappingRun",
        getPayMappingRunBySlug: "runs.getBySlug",
        listPayMappingRuns: "runs.list",
      },
      gap: { getPayMappingGap: "gap.get" },
      analyses: { listGroupAnalyses: "analyses.list" },
      actions: { listActions: "actions.list" },
      notes: { listNotes: "notes.list" },
    },
  },
}))

const exportReportMock = vi.fn(async () => {})
vi.mock("@/components/pay-mapping/pay-mapping-report-export", () => ({
  usePayMappingReportExport: () => ({
    busy: false,
    exportReport: exportReportMock,
    captureHost: null,
  }),
}))

import { PayMappingRunActions } from "@/components/pay-mapping/pay-mapping-run-actions"
import { openMenu } from "@/test/menu"

const labels = messages.dashboard.payMapping.table

function renderActions(label = "Lonekartlaggning 2026") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PayMappingRunActions
        orgId="org-1"
        runId={"run-1" as Id<"payMappingRuns">}
        slug="lonekartlaggning-2026"
        label={label}
      />
    </NextIntlClientProvider>
  )
}

function openRowMenu(label = "Lonekartlaggning 2026") {
  return openMenu(
    screen.getByRole("button", {
      name: labels.rowActionsLabel.replace("{label}", label),
    })
  )
}

describe("PayMappingRunActions", () => {
  beforeEach(() => {
    deleteRunMock.mockReset()
    queryMock.mockClear()
    exportReportMock.mockClear()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.error).mockReset()
  })
  afterEach(() => cleanup())

  it("downloads the report from the row menu, fed by one-shot queries", async () => {
    renderActions()
    await openRowMenu()
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: messages.dashboard.payMapping.report.downloadReport,
      })
    )

    await waitFor(() => {
      expect(exportReportMock).toHaveBeenCalledWith({
        run: RUN_DETAIL,
        gap: GAP,
        analyses: [],
        actions: [],
        notes: [],
        // An empty run history: no earlier completed run to evaluate.
        previous: null,
      })
    })
    // The run detail is fetched by the row's slug (the id is not a route
    // key), everything else by the run id.
    expect(queryMock).toHaveBeenCalledWith("runs.getBySlug", {
      orgId: "org-1",
      slug: "lonekartlaggning-2026",
    })
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it("shows the error toast when the one-shot fetch fails", async () => {
    queryMock.mockRejectedValueOnce(new Error("offline"))
    renderActions()
    await openRowMenu()
    fireEvent.click(
      screen.getByRole("menuitem", {
        name: messages.dashboard.payMapping.report.downloadReport,
      })
    )

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
    expect(exportReportMock).not.toHaveBeenCalled()
  })

  it("opens the delete confirmation dialog from the destructive item, without calling the mutation yet", async () => {
    renderActions()
    await openRowMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))

    expect(screen.getByRole("alertdialog")).toBeDefined()
    expect(
      screen.getByText(
        labels.deleteDialogTitle.replace("{label}", "Lonekartlaggning 2026")
      )
    ).toBeDefined()
    expect(deleteRunMock).not.toHaveBeenCalled()
  })

  it("confirming deletes the run and shows the success toast", async () => {
    deleteRunMock.mockResolvedValue(null)
    renderActions()
    await openRowMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))
    fireEvent.click(screen.getByRole("button", { name: labels.deleteConfirm }))

    await waitFor(() => {
      expect(deleteRunMock).toHaveBeenCalledWith({
        orgId: "org-1",
        runId: "run-1",
      })
    })
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
      messages.dashboard.toast.payMappingDeleted
    )
  })

  it("cancel closes the dialog without deleting", async () => {
    renderActions()
    await openRowMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))
    fireEvent.click(screen.getByRole("button", { name: labels.deleteCancel }))

    expect(deleteRunMock).not.toHaveBeenCalled()
  })

  it("shows an error toast when the mutation rejects, and keeps the dialog open", async () => {
    deleteRunMock.mockRejectedValue(new Error("boom"))
    renderActions()
    await openRowMenu()
    fireEvent.click(screen.getByRole("menuitem", { name: labels.deleteCta }))
    fireEvent.click(screen.getByRole("button", { name: labels.deleteConfirm }))

    await waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
        messages.dashboard.toast.error
      )
    })
    // The failed delete must not close the dialog: the user can retry
    // without re-opening it from the row menu.
    expect(screen.getByRole("alertdialog")).toBeDefined()
  })
})
