import { vi } from "vitest"

// Shared convex/react + generated-api mocks for component tests, replacing
// the per-file vi.mock blocks (which had already drifted into two styles).
//
// Usage in a test file:
//
//   vi.mock("convex/react", async () =>
//     (await import("@/test/convex-mocks")).convexReactModule)
//   vi.mock("@workspace/backend/convex/_generated/api", async () =>
//     (await import("@/test/convex-mocks")).apiModule)
//
//   const createMock = mockMutation("assessment.starters.createStarterSet")
//   onQuery((ref, args) => (ref === "evaluationModel.model.getModel" ? fixture : []))
//
// Refs are plain dot paths: the api mock is a deep proxy where any property
// chain stringifies to its path (api.ai.suggest.rejectSuggestion reads as
// "ai.suggest.rejectSuggestion"), so dispatch happens on strings and no test
// hand-maintains the api module's shape.

type MutationMock = ReturnType<typeof vi.fn>

const mutationMocks = new Map<string, MutationMock>()
const actionMocks = new Map<string, MutationMock>()
let queryHandler: (ref: string, args?: unknown) => unknown = () => undefined

// Registers (or returns the existing) mutation mock for a dot-path ref.
// Module-level registration in the test file is enough; reset it in
// beforeEach like any vi.fn.
export function mockMutation(ref: string): MutationMock {
  const existing = mutationMocks.get(ref)
  if (existing !== undefined) return existing
  const mock = vi.fn()
  mutationMocks.set(ref, mock)
  return mock
}

// Registers (or returns the existing) action mock for a dot-path ref, mirroring
// mockMutation for useAction-backed components.
export function mockAction(ref: string): MutationMock {
  const existing = actionMocks.get(ref)
  if (existing !== undefined) return existing
  const mock = vi.fn()
  actionMocks.set(ref, mock)
  return mock
}

// Installs the useQuery dispatcher. Receives the STRINGIFIED ref plus the
// query args; typically delegated to a per-file vi.fn so tests can swap
// implementations per case.
export function onQuery(handler: (ref: string, args?: unknown) => unknown) {
  queryHandler = handler
}

function pathProxy(path: string): unknown {
  const children = new Map<string | symbol, unknown>()
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (
          prop === Symbol.toPrimitive ||
          prop === "toString" ||
          prop === "valueOf"
        ) {
          return () => path
        }
        if (typeof prop !== "string") return undefined
        let child = children.get(prop)
        if (child === undefined) {
          child = pathProxy(path === "" ? prop : `${path}.${prop}`)
          children.set(prop, child)
        }
        return child
      },
    }
  )
}

export const apiModule = { api: pathProxy("") }

export const convexReactModule = {
  useMutation: (ref: unknown) => mockMutation(String(ref)),
  useAction: (ref: unknown) => mockAction(String(ref)),
  useQuery: (ref: unknown, args?: unknown) => queryHandler(String(ref), args),
}
