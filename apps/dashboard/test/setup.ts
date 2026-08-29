import { configure } from "@testing-library/react"

// Testing Library's async utilities (findBy*, waitFor) give up after 1000ms by
// default, which is a timing assumption rather than an assertion: a suite that
// passes on a developer machine can fail on a loaded CI runner because a render
// or an effect landed a few hundred milliseconds later than usual. That is a
// test failing without a real issue, which is the worst kind: it teaches the
// team to re-run CI instead of reading it.
//
// The longer budget costs a passing test nothing, because a resolved wait
// returns as soon as its condition holds. It is only spent when a test is
// genuinely failing, and paying five seconds there to be sure the failure is
// real is the trade we want.
//
// This is the floor under the whole suite, not a fix for a specific race: a
// gesture that can miss its target still has to be made retry-safe where it is
// written (see test/menu.ts).
//
// The floor covers Testing Library's utilities ONLY. `vi.waitFor` keeps its
// own 1000ms default and sits outside this budget, which is how one dialog
// test failed a full parallel run while passing alone: a real-timer wait for a
// rejected mutation ran out of a second under 295 concurrent files. A wait on
// real timers therefore uses `waitFor` from @testing-library/react. The
// remaining `vi.waitFor` calls are in tests that drive fake timers, where the
// budget is spent against a clock the test advances itself and the two
// utilities are not interchangeable.
configure({
  asyncUtilTimeout: 5000,
  // Recharts measures label widths by writing the text into a hidden span it
  // parks on document.body (#recharts_measurement_span) and never removes, so
  // it outlives the test that rendered the chart and still holds the last
  // string measured. A text query would then match it, which is how one chart
  // test made a later, unrelated one fail on "found multiple elements": the
  // second match was an invisible node from a component that was no longer
  // mounted. It is not content, so no query should ever see it.
  defaultIgnore: "script, style, #recharts_measurement_span",
})

// jsdom implements no Web Animations API, and Base UI's ScrollArea viewport
// calls element.getAnimations() from a timer to wait out an in-flight
// transition before it re-measures. The call lands AFTER the test that
// rendered the scroll area has finished, so the TypeError arrives with no
// test to attach it to: vitest reports it as an unhandled error and the run
// exits non-zero while every assertion passed. That is the worst shape a
// failure can take, because the summary says green and the process says red.
//
// SCOPED TO THAT ONE ELEMENT, deliberately. Defining getAnimations on
// Element.prototype for everything is not a shim, it is a behaviour change:
// Base UI's dismissable surfaces branch on whether the method EXISTS, and
// giving it to them put every dialog, menu and popover on its animated-close
// path, where jsdom never advances the animation and the surface never
// unmounts. Twelve unrelated tests failed. The getter hands the method only
// to the scroll area's own viewport and leaves every other element seeing
// exactly what it saw before, which is nothing.
if (!("getAnimations" in Element.prototype)) {
  Object.defineProperty(Element.prototype, "getAnimations", {
    configurable: true,
    get(this: Element) {
      return this.getAttribute?.("data-slot") === "scroll-area-viewport"
        ? () => []
        : undefined
    },
  })
}
