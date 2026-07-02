import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { RolesPerBandChart } from "@/components/overview/roles-per-band-chart"

describe("RolesPerBandChart", () => {
  afterEach(cleanup)

  it("renders the titled card, the sample badge, and a chart region", () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <RolesPerBandChart />
      </NextIntlClientProvider>
    )
    expect(screen.getByText("Roles per band")).toBeDefined()
    expect(screen.getByText("Sample")).toBeDefined()
    // The shadcn ChartContainer renders a [data-slot="chart"] wrapper; recharts
    // itself does not lay out in jsdom (zero-size container), so assert on the
    // container chrome, not on rendered bar geometry.
    expect(container.querySelector('[data-slot="chart"]')).not.toBeNull()
  })
})
