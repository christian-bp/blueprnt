import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import messages from "@workspace/i18n/messages/en.json"
import { CriterionItem } from "@/components/model/criterion-item"

function renderItem(props: { anchors?: { level: number; text: string }[] }) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ul>
        <CriterionItem
          name="Complexity"
          description="How hard the problems are"
          importanceNode={<span>3</span>}
          editable={false}
          {...props}
        />
      </ul>
    </NextIntlClientProvider>
  )
}

describe("CriterionItem anchor scale section", () => {
  afterEach(() => {
    cleanup()
  })

  const ANCHORS = [
    { level: 0, text: "Not present" },
    { level: 1, text: "Follows instructions" },
    { level: 2, text: "Works independently" },
    { level: 3, text: "Guides others" },
    { level: 4, text: "Shapes the area" },
    { level: 5, text: "Defines the field" },
  ]

  it("renders no trigger without anchors", () => {
    renderItem({})
    expect(
      screen.queryByRole("button", {
        name: messages.dashboard.model.editor.anchors,
      })
    ).toBeNull()
  })

  it("expands to show the anchor texts", async () => {
    renderItem({ anchors: ANCHORS })
    const trigger = screen.getByRole("button", {
      name: messages.dashboard.model.editor.anchors,
    })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(screen.queryByText("Follows instructions")).toBeNull()

    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(await screen.findByText("Follows instructions")).toBeDefined()
    expect(screen.getByText("Defines the field")).toBeDefined()
  })
})
