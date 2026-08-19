import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlacedCriterionCard } from "@/components/model/placed-criterion-card"
import { openMenu } from "@/test/menu"

const editor = messages.dashboard.model.editor
const build = messages.dashboard.model.build
const change = messages.dashboard.model.change

const CRITERION = { criterionId: "c1", name: "Analytical effort" }

function renderCard(
  props: Partial<Parameters<typeof PlacedCriterionCard>[0]> = {}
) {
  const onWeightChange = props.onWeightChange ?? vi.fn()
  const onRemove = props.onRemove ?? vi.fn()
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ul>
        <PlacedCriterionCard
          criterion={CRITERION}
          weight={3}
          share="17.6%"
          {...props}
          onWeightChange={onWeightChange}
          onRemove={onRemove}
        />
      </ul>
    </NextIntlClientProvider>
  )
  return { ...view, onWeightChange, onRemove }
}

const menuTrigger = () =>
  screen.getByRole("button", {
    name: editor.rowMenuLabel.replace("{name}", CRITERION.name),
  })

describe("PlacedCriterionCard", () => {
  afterEach(cleanup)

  it("shows the criterion and what share of the model it carries", () => {
    renderCard()
    expect(screen.getByText(CRITERION.name)).toBeDefined()
    expect(screen.getByText("17.6%")).toBeDefined()
    expect(screen.getByText(build.shareOfTotal)).toBeDefined()
  })

  // The weight lives ON the card rather than on a separate weighting page:
  // the same five-button control, the same 1-5 semantics.
  it("weights the criterion in place", () => {
    const { onWeightChange } = renderCard()
    const group = screen.getByRole("group", {
      name: build.setWeightPoints.replace("{name}", CRITERION.name),
    })
    const options = within(group).getAllByRole("button")
    expect(
      options.map((option) => option.getAttribute("aria-pressed"))
    ).toEqual(["false", "false", "true", "false", "false"])
    fireEvent.click(within(group).getByRole("button", { name: "5" }))
    expect(onWeightChange).toHaveBeenCalledWith(5)
  })

  // The 1-5 evaluation scale and the 1-5 weighting are never on screen
  // together: that pairing is the confusion the phase split existed to kill,
  // and the scale leaves the model surface entirely in this phase.
  it("shows no evaluation scale beside the weighting", () => {
    const { container } = renderCard()
    // Everything the card offers: the five weight points and the row menu.
    // Any scale disclosure would be a seventh control, so counting them is
    // what says the scale is not one press away either.
    expect(container.querySelectorAll("button")).toHaveLength(6)
  })

  // Removing deletes the criterion's ratings on every role, so it confirms
  // first, and the confirmation says what it costs.
  it("confirms before removing the criterion", async () => {
    const { onRemove } = renderCard()
    await openMenu(menuTrigger())
    fireEvent.click(screen.getByRole("menuitem", { name: editor.removeCta }))
    await waitFor(() => {
      expect(
        screen.getByText(
          editor.removeDialogTitle.replace("{name}", CRITERION.name)
        )
      ).toBeDefined()
    })
    expect(screen.getByText(editor.removeDialogDescription)).toBeDefined()
    expect(screen.getByRole("button", { name: change.cancel })).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: editor.removeConfirm }))
    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledTimes(1)
    })
  })

  // The row's action lives behind one trailing trigger that is always there,
  // so nothing appears, disappears or moves under the pointer as it crosses
  // the card: the whole card is the same card before and after the hover, node
  // for node and name for name.
  it("keeps its actions in a slot that is always present", () => {
    const { container } = renderCard()
    expect(menuTrigger()).toBeDefined()
    const namesOf = () =>
      screen
        .getAllByRole("button", { hidden: true })
        .map(
          (button) => button.getAttribute("aria-label") ?? button.textContent
        )
    const nodesBefore = container.querySelectorAll("*").length
    const namesBefore = namesOf()
    fireEvent.mouseEnter(container.querySelectorAll("li")[0] as HTMLElement)
    expect(container.querySelectorAll("*").length).toBe(nodesBefore)
    expect(namesOf()).toEqual(namesBefore)
    // The five weight points plus the one row-actions trigger, and nothing a
    // hover brought with it.
    expect(namesBefore).toHaveLength(6)
  })

  it("takes no input while the removal is in flight", () => {
    renderCard({ removing: true })
    expect((menuTrigger() as HTMLButtonElement).disabled).toBe(true)
  })
})
