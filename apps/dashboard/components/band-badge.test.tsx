import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { BandBadge } from "@/components/band-badge"

const t = messages.assessment

function renderBadge(band: number, className?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BandBadge band={band} className={className} />
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("BandBadge", () => {
  it('composes the label as "Band N"', () => {
    renderBadge(3)
    expect(screen.getByText(`${t.band} 3`)).toBeDefined()
  })

  it("updates the composed label for a different band", () => {
    renderBadge(1)
    expect(screen.getByText(`${t.band} 1`)).toBeDefined()
    expect(screen.queryByText(`${t.band} 3`)).toBeNull()
  })

  it("renders the tag icon, aria-hidden, ahead of the label", () => {
    const { container } = renderBadge(2)
    const icon = container.querySelector("svg[aria-hidden='true']")
    expect(icon).not.toBeNull()
  })

  it("forwards an extra className onto the badge", () => {
    const { container } = renderBadge(2, "shrink-0")
    expect(container.querySelector(".shrink-0")).not.toBeNull()
  })
})
