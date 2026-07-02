// apps/dashboard/components/overview/model-readiness-card.test.tsx
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import messages from "@workspace/i18n/messages/en.json"

const hoisted = vi.hoisted(() => ({
  value: undefined as unknown,
}))
vi.mock("convex/react", () => ({ useQuery: () => hoisted.value }))

import { ModelReadinessCard } from "@/components/overview/model-readiness-card"

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ModelReadinessCard orgId="org1" />
    </NextIntlClientProvider>
  )
}

describe("ModelReadinessCard", () => {
  afterEach(cleanup)

  it("shows a skeleton while loading", () => {
    hoisted.value = undefined
    const { container } = renderCard()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull()
  })

  it("renders nothing when there is no model", () => {
    hoisted.value = null
    const { container } = renderCard()
    expect(container.firstChild).toBeNull()
  })

  it("renders documented and approved progress out of total", () => {
    hoisted.value = { progress: { documented: 9, approved: 5, total: 9 } }
    renderCard()
    expect(screen.getByText("9/9 documented")).toBeDefined()
    expect(screen.getByText("5/9 approved")).toBeDefined()
  })
})
