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
