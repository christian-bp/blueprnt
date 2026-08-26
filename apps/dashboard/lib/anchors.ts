// Steps 1-5 are always per-criterion; the library leaves 2/4 undefined when
// it has nothing more specific to say than "a considered midpoint", and the
// model's shared midpoints copy fills exactly those gaps. One resolver for
// every surface that shows a criterion's full ladder (the rating stepper and
// the method appendix), so the two can never disagree about what a midpoint
// step says.
export function resolveAnchorSteps(
  anchors: readonly { step: number; text: string }[],
  midpoints: { step2: string; step4: string }
): { step: number; text: string }[] {
  const byStep = new Map(anchors.map((anchor) => [anchor.step, anchor.text]))
  return [1, 2, 3, 4, 5].map((step) => {
    const text = byStep.get(step)
    if (text !== undefined) return { step, text }
    return { step, text: step === 2 ? midpoints.step2 : midpoints.step4 }
  })
}
