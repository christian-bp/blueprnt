import messages from "@workspace/i18n/messages/en.json"
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Todo } from "@/lib/todo"

let todoState: Todo | undefined
vi.mock("@/hooks/use-todo", () => ({
  useTodo: () => todoState,
}))
vi.mock("@/components/org-context", () => ({
  useOrganization: () => ({ orgId: "org-1", role: "admin" }),
}))
// The digit animation is the library's business; these tests are about the
// count's value.
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

import { TodoFooter } from "@/components/todo-footer"

function tree() {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <TodoFooter />
    </NextIntlClientProvider>
  )
}

function renderFooter() {
  return render(tree())
}

// Fixture groups in buildTodo's own priority order; only the fields the
// footer reads matter to these tests.
const evaluate = {
  key: "evaluateRoles",
  items: [],
  count: 3,
} as unknown as Todo["groups"][number]
const classify = {
  key: "classifyPeople",
  items: [],
  count: 5,
} as unknown as Todo["groups"][number]
const startRun = {
  key: "startPayMapping",
  items: [],
  count: 1,
} as unknown as Todo["groups"][number]

describe("TodoFooter", () => {
  beforeEach(() => {
    todoState = undefined
  })
  afterEach(() => cleanup())

  it("renders nothing while the to-do derivation loads", () => {
    const { container } = renderFooter()
    expect(container.firstElementChild).toBeNull()
  })

  it("renders nothing when caught up", () => {
    todoState = { groups: [], total: 0 }
    const { container } = renderFooter()
    expect(container.firstElementChild).toBeNull()
  })

  // The rows are Base UI Buttons rendered as anchors, so they expose the
  // button role (the app-wide nav-row idiom); the href is what proves each
  // one leads where the work is done.
  it("shows the top groups as rows leading to where the work is done, with counts", () => {
    todoState = { groups: [evaluate, classify], total: 8 }
    renderFooter()
    expect(
      screen.getByText(messages.dashboard.overview.sectionTodo)
    ).toBeTruthy()
    const groups = messages.dashboard.overview.todo.groups
    const evaluateRow = screen.getByRole("button", {
      name: new RegExp(groups.evaluateRoles),
    })
    expect(evaluateRow.getAttribute("href")).toBe("/roles")
    expect(evaluateRow.textContent).toContain("3")
    const classifyRow = screen.getByRole("button", {
      name: new RegExp(groups.classifyPeople),
    })
    expect(classifyRow.getAttribute("href")).toBe("/people/classify")
    expect(classifyRow.textContent).toContain("5")
  })

  it("shows a glance of at most two groups, never the whole band", () => {
    todoState = { groups: [evaluate, classify, startRun], total: 9 }
    renderFooter()
    expect(screen.getAllByRole("button")).toHaveLength(2)
    expect(
      screen.queryByText(
        messages.dashboard.overview.todo.groups.startPayMapping
      )
    ).toBeNull()
  })

  it("renders the block statically, with no clip on the animated row wrappers", () => {
    todoState = { groups: [evaluate], total: 3 }
    const { container } = renderFooter()
    // The block itself is static (a page switch remounts it, so a block
    // enter animation replayed on every navigation); it renders straight as
    // its bordered footer section.
    const block = container.firstElementChild as HTMLElement
    expect(block.className).toContain("border-t")
    const row = screen.getByRole("button", {
      name: new RegExp(messages.dashboard.overview.todo.groups.evaluateRoles),
    })
    // button -> CelebrationBurst's positioned div -> the row's motion
    // wrapper. Rows still animate (celebration exits), and their exits are
    // staged rather than clipped: an overflow-hidden here would eat a
    // celebrating row's confetti.
    const rowWrapper = row.parentElement?.parentElement as HTMLElement
    expect(rowWrapper.className).not.toContain("overflow-hidden")
  })

  it("keeps a finished group's row on screen, celebrating, before it leaves", () => {
    todoState = { groups: [evaluate, classify], total: 8 }
    const view = renderFooter()
    // The first load is not a finish: nothing celebrates.
    expect(screen.queryByTestId("success-confetti")).toBeNull()

    // The evaluate group completes: it leaves buildTodo's output entirely.
    todoState = { groups: [classify], total: 5 }
    view.rerender(tree())
    const groups = messages.dashboard.overview.todo.groups
    const finishedRow = screen.getByRole("button", {
      name: new RegExp(groups.evaluateRoles),
    })
    expect(finishedRow).toBeTruthy()
    const bursts = screen.getAllByTestId("success-confetti")
    expect(bursts).toHaveLength(1)
    // The celebration wraps the finished row, not its still-open neighbour.
    expect(
      (bursts[0] as HTMLElement).parentElement?.contains(finishedRow)
    ).toBe(true)
  })

  it("holds the block open while the last group's celebration plays", () => {
    todoState = { groups: [evaluate], total: 3 }
    const view = renderFooter()
    todoState = { groups: [], total: 0 }
    view.rerender(tree())
    expect(
      screen.getByText(messages.dashboard.overview.sectionTodo)
    ).toBeTruthy()
    expect(screen.getByTestId("success-confetti")).toBeTruthy()
  })

  // The single-act groups (build the model, import, start the mapping) have
  // a structural count of 1; a "1" badge beside an act is noise, so only
  // quantity groups carry one (GROUP_COUNT_IS_QUANTITY).
  it("shows no count on the single-act groups", () => {
    const importGroup = {
      key: "importPeople",
      items: [],
      count: 1,
    } as unknown as Todo["groups"][number]
    todoState = { groups: [importGroup, startRun], total: 2 }
    const { container } = renderFooter()
    expect(screen.getAllByRole("button")).toHaveLength(2)
    expect(container.querySelector('[data-slot="badge"]')).toBeNull()
  })

  it("does not celebrate a group merely pushed out of the glance", () => {
    todoState = { groups: [classify, startRun], total: 6 }
    const view = renderFooter()
    // A higher-priority group arrives; startRun is still outstanding, just
    // below the two-row glance.
    todoState = { groups: [evaluate, classify, startRun], total: 9 }
    view.rerender(tree())
    expect(screen.queryByTestId("success-confetti")).toBeNull()
  })
})
