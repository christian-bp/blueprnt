import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { LevelBadge } from "@/components/level-badge"

const t = messages.assessment

function renderBadge(level: number, className?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LevelBadge level={level} className={className} />
    </NextIntlClientProvider>
  )
}

afterEach(() => cleanup())

describe("LevelBadge", () => {
  it('composes the label as "Level N"', () => {
    renderBadge(3)
    expect(screen.getByText(`${t.level} 3`)).toBeDefined()
  })

  it("updates the composed label for a different level", () => {
    renderBadge(1)
    expect(screen.getByText(`${t.level} 1`)).toBeDefined()
    expect(screen.queryByText(`${t.level} 3`)).toBeNull()
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
