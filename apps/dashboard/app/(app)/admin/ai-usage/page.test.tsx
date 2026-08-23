import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { onQuery } from "@/test/convex-mocks"

const useQueryMock = vi.fn()
onQuery((ref, args) => useQueryMock(ref, args))

vi.mock(
  "convex/react",
  async () => (await import("@/test/convex-mocks")).convexReactModule
)
vi.mock(
  "@workspace/backend/convex/_generated/api",
  async () => (await import("@/test/convex-mocks")).apiModule
)

import AdminAiUsagePage from "@/app/(app)/admin/ai-usage/page"

const t = messages.dashboard.admin.aiUsage
const tTabs = messages.dashboard.admin.tabs
const tKpi = t.kpi

function renderPage() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Europe/Stockholm"
    >
      <AdminAiUsagePage />
    </NextIntlClientProvider>
  )
}

describe("AdminAiUsagePage", () => {
  beforeEach(() => {
    useQueryMock.mockReset()
    useQueryMock.mockImplementation(() => undefined)
  })

  afterEach(() => cleanup())

  it("renders the AI usage heading and period selector before the query resolves", () => {
    renderPage()
    expect(
      screen.getByRole("heading", { level: 1, name: tTabs.aiUsage })
    ).toBeTruthy()
    expect(screen.getByRole("combobox", { name: t.periodLabel })).toBeTruthy()
  })

  it("shows the KPI labels and a skeleton table while loading, nothing crashes", () => {
    renderPage()
    expect(screen.getByText(tKpi.costLabel)).toBeTruthy()
    expect(screen.getByText(t.chart.title)).toBeTruthy()
    expect(screen.getByRole("table")).toBeTruthy()
  })
})
