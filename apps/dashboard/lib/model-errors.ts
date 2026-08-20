import { ConvexError } from "convex/values"

// The backend error codes the model section's own surfaces can provoke, each
// with its own translated message under `errors.*`. Declared once because
// three surfaces raise them (the library picker, the Kriterier chapter's
// removal, the Viktning chapter's save) and a code known to one of them but
// not the others would surface there as the generic "something went wrong".
//
// The backend stays the authority on every cap even though the views close the
// routes in first: a second tab, a stale render, or a race can still reach a
// mutation the view believed was open.
const MODEL_ERROR_KEYS = [
  "dimensionCapExceeded",
  "tooManyCriteria",
  "criterionAlreadySelected",
  "weightsUnbalanced",
] as const

type ModelErrorKey = (typeof MODEL_ERROR_KEYS)[number]

// The known error this failure is, or undefined for anything else (which the
// caller answers with its generic toast).
export function modelErrorKey(error: unknown): ModelErrorKey | undefined {
  if (!(error instanceof ConvexError)) return undefined
  const code = (error.data as { code?: string } | null)?.code
  return MODEL_ERROR_KEYS.find((key) => code === `errors.${key}`)
}
