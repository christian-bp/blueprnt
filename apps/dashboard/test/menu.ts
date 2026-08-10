import { fireEvent, waitFor } from "@testing-library/react"
import { expect } from "vitest"

// Opens a Base UI menu (or any popup trigger) in a way that cannot lose a race
// with the render.
//
// Every menu test used to hand-roll the same two lines, `fireEvent.pointerDown`
// then `fireEvent.click`, and then look for an item inside the popup. That
// gesture only opens anything if React has already wired the trigger up, and a
// trigger can be in the DOM a commit before it is: the popup then never opens
// and the test fails on an item that was never rendered. It passed on every
// machine we tried, including under CPU load, and failed on CI in two
// different suites on two different pushes, which is what a race does rather
// than a bug. One suite had already papered over it locally (the role-import
// wizard, "failed roughly one run in six").
//
// Retrying the gesture until the trigger reports itself open takes the timing
// out of the test without weakening a single assertion: the popup either opens
// or the wait fails, and the caller still decides what to look for inside it.
//
// The open check reads the TRIGGER's own state rather than looking for popup
// content, for two reasons: the caller may be about to assert that some item is
// absent, and a retry must never fire at an already-open menu, which would
// toggle it shut. Base UI sets both signals together on an open trigger; either
// one is enough, so this works for the menus, the popovers and the selects
// alike.
export async function openMenu(trigger: HTMLElement): Promise<void> {
  await waitFor(() => {
    if (!isOpen(trigger)) {
      fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })
      fireEvent.click(trigger)
    }
    expect(isOpen(trigger)).toBe(true)
  })
}

function isOpen(trigger: HTMLElement): boolean {
  return (
    trigger.hasAttribute("data-popup-open") ||
    trigger.getAttribute("aria-expanded") === "true"
  )
}
