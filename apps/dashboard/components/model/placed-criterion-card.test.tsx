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
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// NumberFlow renders a custom element happy-dom never upgrades, and the card's
// two figures change in place. The digit animation is the library's business;
// these tests are about the figures.
vi.mock("@number-flow/react", () => ({
  // Format-aware on purpose: the figures this surface rolls are percentages,
  // so a mock that ignored `format` would let a wrong Intl option pass.
  default: ({
    value,
    format,
  }: {
    value: number
    format?: Intl.NumberFormatOptions
  }) => (
    <span>
      {format === undefined
        ? value
        : new Intl.NumberFormat("en", format).format(value)}
    </span>
  ),
}))
import {
  PlacedCriterionCard,
  type PlacedCriterionWeight,
} from "@/components/model/placed-criterion-card"

const editor = messages.dashboard.model.editor
const weighting = messages.dashboard.model.weighting
const change = messages.dashboard.model.change
const method = messages.dashboard.model.method

// The share line's own words, taken from the one message that renders it: a
// card that carries no share carries none of this either.
const SHARE_TEXT = weighting.shareOfWeight.replace("<share></share>", "").trim()

const CRITERION = {
  criterionId: "c1",
  name: "Analytical effort",
  shortUiText: "How much analysis the work demands",
}

function wrap(card: ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ul>{card}</ul>
    </NextIntlClientProvider>
  )
}

// The Kriterier chapter's card: the criterion is in the model, and the one
// thing that chapter decides about it is whether it stays.
function renderSelection(overrides: { removing?: boolean } = {}) {
  const onRemove = vi.fn()
  const view = wrap(
    <PlacedCriterionCard
      criterion={CRITERION}
      onRemove={onRemove}
      {...overrides}
    />
  )
  return { ...view, onRemove }
}

// The Viktning chapter's card: how much the criterion counts.
function renderWeighted(overrides: Partial<PlacedCriterionWeight> = {}) {
  const onChange = vi.fn()
  const view = wrap(
    <PlacedCriterionCard
      criterion={CRITERION}
      // A fraction now, not formatted text: the card renders it through
      // NumberFlow, so the formatting lives with the shares' one source.
      weight={{ points: 3, share: 0.176, onChange, ...overrides }}
    />
  )
  return { ...view, onChange }
}

// The Metod chapter's card: where the criterion's documentation stands, and
// the way into the dialog that moves it.
function renderDocumented(
  overrides: {
    status?: "notStarted" | "inProgress" | "documented" | "approved"
    partners?: string[]
    admin?: boolean
  } = {}
) {
  const { status = "inProgress", partners = [], admin = true } = overrides
  const onDocument = vi.fn()
  const view = wrap(
    <PlacedCriterionCard
      criterion={CRITERION}
      documentation={{
        status,
        partners,
        onDocument: admin ? onDocument : undefined,
      }}
    />
  )
  return { ...view, onDocument }
}

const removeTrigger = () =>
  screen.getByRole("button", {
    name: editor.removeLabel.replace("{name}", CRITERION.name),
  })

describe("PlacedCriterionCard", () => {
  afterEach(cleanup)

  // With the library lists gone from the page there is room for the library's
  // own one-liner, and it is what tells the reader what they actually chose.
  // Both chapters carry it, so a criterion reads the same wherever it is
  // listed.
  it("names the criterion and says what it is for, on every card", () => {
    for (const renderCard of [
      renderSelection,
      renderWeighted,
      renderDocumented,
    ]) {
      renderCard()
      expect(screen.getByText(CRITERION.name)).toBeDefined()
      expect(screen.getByText(CRITERION.shortUiText)).toBeDefined()
      cleanup()
    }
  })

  // Built on the design system's Item family rather than hand-rolled markup,
  // so a criterion row reads like every other listed thing in the app.
  it("is a design-system Item, with the name and one-liner in its own slots", () => {
    const { container } = renderSelection()
    const item = container.querySelector('[data-slot="item"]')
    expect(item?.tagName).toBe("LI")
    expect(item?.querySelector('[data-slot="item-title"]')?.textContent).toBe(
      CRITERION.name
    )
    expect(
      item?.querySelector('[data-slot="item-description"]')?.textContent
    ).toBe(CRITERION.shortUiText)
    expect(item?.querySelector('[data-slot="item-actions"]')).not.toBeNull()
  })

  // No size deviation: the card takes the Item family's default, which is what
  // makes it read at full column width, and both variants take it together.
  // The picker rows a criterion is chosen from are default too, so the same
  // criterion reads the same in both places.
  it("takes the Item family's default size on every variant", () => {
    for (const render of [renderSelection, renderWeighted, renderDocumented]) {
      const { container } = render()
      const item = container.querySelector('[data-slot="item"]')
      expect(item?.getAttribute("data-size")).toBe("default")
      // The description takes ItemDescription's own text-sm at this size,
      // never a call-site shrink. Split into tokens rather than substring
      // matched: the vendor base itself carries a
      // group-data-[size=xs]/item:text-xs variant, which a naive
      // not.toContain would hit whether or not a bare text-xs was added.
      const description = item?.querySelector('[data-slot="item-description"]')
      const tokens = (description?.className ?? "").split(/\s+/)
      expect(tokens).toContain("text-sm")
      expect(tokens).not.toContain("text-xs")
      cleanup()
    }
  })

  // The Kriterier chapter is about which criteria are IN the model, and
  // nothing else: a 1-5 weight row beside a criterion the reader is still
  // deciding to include is the confusion the chapters exist to end.
  it("carries no weighting on the selection card", () => {
    const { container } = renderSelection()
    expect(screen.queryByText(new RegExp(SHARE_TEXT))).toBeNull()
    expect(
      screen.queryByRole("group", {
        name: weighting.setWeightPoints.replace("{name}", CRITERION.name),
      })
    ).toBeNull()
    // The remove trigger is the card's only control here.
    expect(container.querySelectorAll("button")).toHaveLength(1)
  })

  // The name is what the card exists to say, and a four-column grid cuts a
  // real library name in half, so it wraps instead of truncating. Asserted
  // against ItemTitle's OWN vendor base (line-clamp-1): a "not truncate" check
  // passes with the override deleted, because the vendor never used that word.
  it("lets the criterion's name and one-liner wrap rather than clamping them", () => {
    renderSelection()
    for (const node of [
      screen.getByText(CRITERION.name),
      screen.getByText(CRITERION.shortUiText),
    ]) {
      expect(node.className).toContain("line-clamp-none")
      expect(node.className).not.toContain("line-clamp-1")
      expect(node.className).not.toContain("line-clamp-2")
    }
  })

  // ONE line under the row, carrying the SHARE alone: the row's fill already
  // says which of the five points is set, so repeating the value here made the
  // reader read one allocation twice. The share is what the row cannot say.
  it("shows the share alone under the row, never the points again", () => {
    const { container } = renderWeighted()
    const line = [...container.querySelectorAll("p")].find((p) =>
      p.textContent?.includes(SHARE_TEXT)
    )
    expect(line).toBeDefined()
    expect(line?.textContent).toBe(
      weighting.shareOfWeight.replace("<share></share>", "18%")
    )
    // The 3 the row is set to appears on the row and nowhere else on the card.
    expect(line?.textContent).not.toContain("3 ·")
  })

  it("weights the criterion in place", () => {
    const { onChange } = renderWeighted()
    const group = screen.getByRole("group", {
      name: weighting.setWeightPoints.replace("{name}", CRITERION.name),
    })
    const options = within(group).getAllByRole("button")
    expect(
      options.map((option) => option.getAttribute("aria-pressed"))
    ).toEqual(["false", "false", "true", "false", "false"])
    fireEvent.click(within(group).getByRole("button", { name: "5" }))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  // Changing WHICH criteria are in the model is the Kriterier chapter's job
  // alone; this chapter only distributes points among them.
  it("offers no way out on the weighting card", () => {
    const { container } = renderWeighted()
    expect(
      screen.queryByRole("button", {
        name: editor.removeLabel.replace("{name}", CRITERION.name),
      })
    ).toBeNull()
    // Exactly the five weight points, and nothing else. Any scale disclosure
    // or removal would be a sixth control, so counting them is what says the
    // evaluation scale is not one press away from the weighting either.
    expect(container.querySelectorAll("button")).toHaveLength(5)
  })

  // The Metod card: the chapter's own decision, in the Item family's footer
  // slot so the name above it keeps the card's full width.
  //
  // The status is a word in plain text now: the outline Badge that used to
  // carry it read as a chip the reader could act on, and put a bordered box on
  // every card in a four-column grid. The INK is the distinction between the
  // two complete states, so it is asserted rather than eyeballed.
  const footerOf = (container: HTMLElement) =>
    within(container.querySelector('[data-slot="item-footer"]') as HTMLElement)

  it("states the documentation status and offers the way in, in its footer", () => {
    const { container } = renderDocumented({ status: "documented" })
    expect(container.querySelector('[data-slot="item-footer"]')).not.toBeNull()
    const inFooter = footerOf(container)
    const word = inFooter.getByText(method.status.documented)
    // Written but not signed off: the muted ink, never the success green.
    expect(word.className).toContain("text-muted-foreground")
    expect(container.querySelector(".text-success")).toBeNull()
    // Something is written: the action is to change it, not to write it.
    expect(inFooter.getByRole("button", { name: method.editCta })).toBeDefined()
    // No pill and no mark: the word alone carries the state.
    expect(container.querySelector('[data-slot="badge"]')).toBeNull()
    expect(container.querySelector("svg")).toBeNull()
  })

  it("says an approved criterion in the success ink", () => {
    const { container } = renderDocumented({ status: "approved" })
    const inFooter = footerOf(container)
    const word = inFooter.getByText(method.status.approved)
    expect(word.className).toContain("text-success")
    expect(word.className).not.toContain("text-muted-foreground")
    expect(inFooter.getByRole("button", { name: method.editCta })).toBeDefined()
  })

  // Absence is the status. A word for "not started" on every card of a fresh
  // model is six sentences saying the model is new, and the action beside the
  // empty slot already says what to do about it.
  it("says nothing at all about a criterion nobody has documented", () => {
    for (const status of ["notStarted", "inProgress"] as const) {
      const { container } = renderDocumented({ status })
      const inFooter = footerOf(container)
      expect(container.querySelector("svg")).toBeNull()
      expect(
        inFooter.getByRole("button", { name: method.openCta })
      ).toBeDefined()
      expect(
        inFooter.queryByRole("button", { name: method.editCta })
      ).toBeNull()
      cleanup()
    }
  })

  it("opens the documentation from the card's own action", () => {
    const { onDocument } = renderDocumented()
    fireEvent.click(screen.getByRole("button", { name: method.openCta }))
    expect(onDocument).toHaveBeenCalledTimes(1)
  })

  // The dialog behind the action is a write surface end to end, so an editor is
  // not offered its entry point at all. Where the criterion stands is still
  // said: reading the documentation is every member's.
  it("offers an editor no way in, while still saying where the criterion stands", () => {
    const { container } = renderDocumented({
      status: "documented",
      admin: false,
    })
    expect(screen.getByText(method.status.documented)).toBeDefined()
    expect(screen.queryByRole("button", { name: method.openCta })).toBeNull()
    expect(screen.queryByRole("button", { name: method.editCta })).toBeNull()
    expect(container.querySelectorAll("button")).toHaveLength(0)
  })

  // The overlap the Godkännande checklist calls "unreviewed", named on the card
  // whose own action writes the note that clears it.
  it("names the criteria an unreviewed overlap is against", () => {
    renderDocumented({ partners: ["Complexity", "Domain knowledge"] })
    expect(
      screen.getByText(
        method.overlapFlag.replace("{names}", "Complexity and Domain knowledge")
      )
    ).toBeDefined()
  })

  it("raises no overlap flag when the engine reports none", () => {
    renderDocumented()
    expect(screen.queryByText(/Overlap with/)).toBeNull()
  })

  // Documenting a criterion neither weights it nor removes it: those are the
  // other two chapters', and the card carries one chapter's decision only.
  it("carries no weighting and no way out on the documentation card", () => {
    const { container } = renderDocumented()
    expect(screen.queryByText(new RegExp(SHARE_TEXT))).toBeNull()
    expect(
      screen.queryByRole("group", {
        name: weighting.setWeightPoints.replace("{name}", CRITERION.name),
      })
    ).toBeNull()
    expect(
      screen.queryByRole("button", {
        name: editor.removeLabel.replace("{name}", CRITERION.name),
      })
    ).toBeNull()
    // The one way into the dialog is the card's only control.
    expect(container.querySelectorAll("button")).toHaveLength(1)
  })

  // Removal takes the criterion's ratings off every role, so it never fires on
  // one press: the trashcan arms into a confirm pill, and the confirm names
  // the object rather than saying "Delete".
  it("arms before removing, and confirms on the second press", async () => {
    const { onRemove } = renderSelection()
    // Idle: the trashcan only. Nothing to confirm yet.
    expect(removeTrigger()).toBeDefined()
    expect(
      screen.queryByRole("button", { name: editor.removeConfirm })
    ).toBeNull()

    fireEvent.click(removeTrigger())
    const confirm = await screen.findByRole("button", {
      name: editor.removeConfirm,
    })
    expect(onRemove).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: change.cancel })).toBeDefined()

    fireEvent.click(confirm)
    await waitFor(() => {
      expect(onRemove).toHaveBeenCalledTimes(1)
    })
  })

  // The way back is where the reader armed it: cancelling restores the
  // trashcan and calls nothing.
  it("disarms without removing when cancelled", async () => {
    const { onRemove } = renderSelection()
    fireEvent.click(removeTrigger())
    await screen.findByRole("button", { name: editor.removeConfirm })
    fireEvent.click(screen.getByRole("button", { name: change.cancel }))
    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: editor.removeConfirm })
      ).toBeNull()
    })
    expect(onRemove).not.toHaveBeenCalled()
    expect(removeTrigger()).toBeDefined()
  })

  // The armed pill overlays the card leftwards from an absolutely positioned
  // slot, so nothing in its ancestor chain may clip it.
  it("anchors the armed pill in a positioned slot no ancestor clips", () => {
    const { container } = renderSelection()
    const slot = removeTrigger().closest("span.relative")
    expect(slot).not.toBeNull()
    for (
      let node = slot?.parentElement ?? null;
      node !== null && node !== container;
      node = node.parentElement
    ) {
      expect(node.className).not.toContain("overflow-hidden")
      expect(node.className).not.toContain("overflow-x-")
      expect(node.className).not.toContain("overflow-y-")
    }
  })

  // The row's action lives behind one trailing trigger that is always there,
  // so nothing appears, disappears or moves under the pointer as it crosses
  // the card: the whole card is the same card before and after the hover, node
  // for node and name for name.
  it("keeps its actions in a slot that is always present", () => {
    const { container } = renderSelection()
    expect(removeTrigger()).toBeDefined()
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
    expect(namesBefore).toHaveLength(1)
  })

  it("takes no input while the removal is in flight", () => {
    renderSelection({ removing: true })
    expect((removeTrigger() as HTMLButtonElement).disabled).toBe(true)
  })
})
