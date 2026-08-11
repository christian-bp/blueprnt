import { cleanup, render, screen, waitFor } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it } from "vitest"
import { OrganizationProvider } from "@/components/org-context"
import { TodoActions } from "@/components/overview/todo-actions"
import type { Todo, TodoGroup } from "@/lib/todo"

const t = messages.dashboard.overview
const BURST = '[data-testid="success-confetti"]'

function tree(todo: Todo | undefined, orgId: string, pageLoaded: boolean) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <OrganizationProvider value={{ orgId, name: "Acme", role: "admin" }}>
        <TodoActions todo={todo} pageLoaded={pageLoaded} />
      </OrganizationProvider>
    </NextIntlClientProvider>
  )
}

function renderActions(
  todo: Todo | undefined,
  orgId = "org-1",
  pageLoaded = true
) {
  return render(tree(todo, orgId, pageLoaded))
}

// The burst waits for frames that came back on time, so it appears a few
// frames after the render rather than inside it. Waiting a fixed handful of
// frames is what lets a test assert the burst is NOT there: a waitFor can only
// ever prove something arrived.
function nextFrames(count = 6): Promise<void> {
  return new Promise((resolve) => {
    let left = count
    function step() {
      left -= 1
      if (left <= 0) {
        resolve()
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

function roleItem(id: string) {
  return { id, title: id, href: `/roles/${id}` }
}

const CLASSIFY: TodoGroup = {
  key: "classifyPeople",
  items: [
    { id: "eng", title: "Engineer", href: "/people/classify", peopleCount: 3 },
  ],
  count: 3,
}
const DESCRIBE: TodoGroup = {
  key: "describeRoles",
  items: [roleItem("a"), roleItem("b")],
  count: 2,
}
const IMPORT: TodoGroup = {
  key: "importPeople",
  items: [{ id: "importPeople", href: "/people/import" }],
  count: 1,
}
const START: TodoGroup = {
  key: "startPayMapping",
  items: [{ id: "startPayMapping", href: "/pay-mappings" }],
  count: 1,
}
const APPROVE: TodoGroup = {
  key: "approveCriteria",
  items: [],
  count: 9,
}
const EVALUATE: TodoGroup = {
  key: "evaluateRoles",
  items: [],
  count: 4,
}

function todoWith(groups: TodoGroup[]): Todo {
  return { groups, total: groups.reduce((sum, g) => sum + g.count, 0) }
}

afterEach(cleanup)

// The burst is an arrival effect with one shot per company, so each test
// arrives as a company of its own: sharing an id would make a test pass or
// fail on which one ran first.
describe("TodoActions arrival burst", () => {
  // The burst marks which of the four cards are work, so every work card
  // throws one and the padding links throw none.
  it("throws a burst on each work card and none on the padding links", async () => {
    const { container } = renderActions(
      todoWith([CLASSIFY, DESCRIBE]),
      "burst-cards"
    )
    await waitFor(() => {
      expect(container.querySelectorAll(BURST)).toHaveLength(2)
    })
    const bursts = container.querySelectorAll(BURST)
    for (const burst of bursts) {
      // A sibling of the card, never a child: a Card clips its overflow and
      // would cut the pieces off at its edge.
      expect(burst.closest('[data-slot="card"]')).toBeNull()
      expect(
        burst.parentElement
          ?.querySelector("[data-tone]")
          ?.getAttribute("data-tone")
      ).toBe("brand")
    }
  })

  it("does not throw it again later in the session", async () => {
    const first = renderActions(todoWith([CLASSIFY]), "burst-once")
    await waitFor(() => {
      expect(first.container.querySelectorAll(BURST)).toHaveLength(1)
    })
    cleanup()
    const { container } = renderActions(todoWith([CLASSIFY]), "burst-once")
    await nextFrames()
    expect(container.querySelectorAll(BURST)).toHaveLength(0)
  })

  // Once per COMPANY, not once per app. A single flag meant the first company
  // to show work spent the only burst there was, so switching company never
  // celebrated again, and finishing onboarding for a new company landed on a
  // dashboard the previous one had already used up.
  it("throws it again for a company that has not arrived yet", async () => {
    const first = renderActions(todoWith([CLASSIFY]), "burst-company-a")
    await waitFor(() => {
      expect(first.container.querySelectorAll(BURST)).toHaveLength(1)
    })
    cleanup()
    const { container } = renderActions(todoWith([CLASSIFY]), "burst-company-b")
    await waitFor(() => {
      expect(container.querySelectorAll(BURST)).toHaveLength(1)
    })
  })

  // Nothing to point at, nothing to celebrate: the standing destinations are
  // not work.
  it("throws nothing when the row is only standing destinations", async () => {
    const { container } = renderActions(todoWith([]), "burst-no-work")
    await nextFrames()
    expect(container.querySelectorAll(BURST)).toHaveLength(0)
  })

  // The row's own query is one of six on this page. Firing on that one alone
  // threw the burst into the render that mounts the widgets and the charts,
  // where it ran out its life inside blocked frames and reached the screen as
  // its own last frame or as nothing at all. It waits for the whole page, and
  // waiting must not COST the burst: the one shot per company is still unspent
  // when the page finishes arriving.
  it("holds the burst until the whole page has loaded, without spending it", async () => {
    const todo = todoWith([CLASSIFY])
    const { container, rerender } = renderActions(
      todo,
      "burst-late-page",
      false
    )
    await nextFrames()
    expect(container.querySelectorAll(BURST)).toHaveLength(0)

    rerender(tree(todo, "burst-late-page", true))
    await waitFor(() => {
      expect(container.querySelectorAll(BURST)).toHaveLength(1)
    })
  })
})

describe("TodoActions", () => {
  it("renders one card per outstanding group, linking to where that work is done", () => {
    renderActions(todoWith([CLASSIFY, DESCRIBE]))
    expect(
      screen
        .getByRole("link", { name: t.todo.groups.classifyPeople })
        .getAttribute("href")
    ).toBe("/people/classify")
    expect(
      screen
        .getByRole("link", { name: t.todo.groups.describeRoles })
        .getAttribute("href")
    ).toBe("/roles")
  })

  it("says how much is waiting on each card", () => {
    renderActions(todoWith([CLASSIFY, APPROVE]))
    expect(screen.getByText("3 people")).toBeDefined()
    expect(screen.getByText("9 items")).toBeDefined()
  })

  // Importing and starting the mapping are one act, not a quantity: a card
  // reading "1 item" would be counting to one.
  it("names the act instead of counting on the single-row groups", () => {
    renderActions(todoWith([IMPORT, START]))
    expect(screen.getByText(t.todo.importPeopleItem)).toBeDefined()
    expect(screen.getByText(t.todo.startPayMappingItem)).toBeDefined()
    expect(screen.queryByText("1 item")).toBeNull()
  })

  // buildTodo emits its groups in priority order, so the row keeps the first
  // four rather than picking or wrapping to a second line.
  it("caps the row at four cards, keeping the most pressing", () => {
    renderActions(
      todoWith([IMPORT, CLASSIFY, DESCRIBE, EVALUATE, APPROVE, START])
    )
    expect(screen.getAllByRole("link")).toHaveLength(4)
    expect(screen.queryByText(t.todo.groups.approveCriteria)).toBeNull()
  })

  // A band with one card and three holes reads as broken, so the standing
  // destinations pad the row out.
  it("fills the rest of the row with standing destinations", () => {
    renderActions(todoWith([APPROVE]))
    expect(screen.getAllByRole("link")).toHaveLength(4)
    expect(screen.getByText(t.todo.groups.approveCriteria)).toBeDefined()
    expect(screen.getByText(t.quickActions.importEmployees.label)).toBeDefined()
  })

  // The tone is what separates work from a way in, so the row needs no
  // second heading. It has to carry across a whole row at a glance, so it
  // rides on the card's own surface, not only on its chip.
  // The work card has to OCCLUDE: the confetti paints behind it, so a
  // translucent background lets the pieces show through from inside the card.
  // twMerge collapses bg-*, so a `bg-brand/N` wash here silently replaces the
  // Card's own bg-card and leaves nothing opaque underneath.
  it("gives the work card an opaque background rather than a wash", () => {
    const { container } = renderActions(todoWith([APPROVE]))
    const work = container.querySelector('[data-tone="brand"]')
    const backgrounds =
      (work?.getAttribute("class") ?? "").match(/(^|\s)bg-\S+/g) ?? []
    expect(backgrounds.length).toBeGreaterThan(0)
    for (const background of backgrounds) {
      expect(background).toContain("color-mix")
    }
  })

  it("tones the work cards apart from the padding links", () => {
    const { container } = renderActions(todoWith([APPROVE]))
    const tones = [...container.querySelectorAll("[data-tone]")].map((card) =>
      card.getAttribute("data-tone")
    )
    expect(tones).toEqual(["brand", "muted", "muted", "muted"])
  })

  // The same surface twice reads as a bug rather than as emphasis.
  it("drops a padding link whose destination is already on the row", () => {
    renderActions(todoWith([DESCRIBE]))
    expect(
      screen.queryAllByRole("link", { name: t.quickActions.roles.label })
    ).toHaveLength(0)
    expect(screen.getAllByRole("link")).toHaveLength(4)
  })

  it("shows only the standing destinations when nothing is outstanding", () => {
    renderActions(todoWith([]))
    for (const [key, href] of [
      ["importEmployees", "/people/import"],
      ["classify", "/people/classify"],
      ["roles", "/roles"],
      ["startPayMapping", "/pay-mappings"],
    ] as const) {
      expect(
        screen
          .getByRole("link", { name: t.quickActions[key].label })
          .getAttribute("href")
      ).toBe(href)
    }
  })

  // The heading follows the cards. "To do" over four standing destinations
  // would tell a reader who has finished everything that work is waiting.
  it("heads the band as work while something is outstanding", () => {
    renderActions(todoWith([APPROVE]))
    expect(screen.getByRole("heading", { name: t.sectionTodo })).toBeDefined()
    expect(screen.queryByText(t.sectionQuickActions)).toBeNull()
  })

  it("heads the band as destinations when nothing is outstanding", () => {
    renderActions(todoWith([]))
    expect(
      screen.getByRole("heading", { name: t.sectionQuickActions })
    ).toBeDefined()
    expect(screen.queryByText(t.sectionTodo)).toBeNull()
  })

  // Which heading it is, is data. Guessing one and renaming it on arrival
  // reads as the page changing its mind, so the line is held with a bar and
  // the row below does not move either way.
  it("holds the heading's line while the to-do is still loading", () => {
    renderActions(undefined)
    expect(screen.queryByRole("heading")).toBeNull()
    expect(screen.queryByText(t.sectionTodo)).toBeNull()
    expect(screen.queryByText(t.sectionQuickActions)).toBeNull()
  })

  // Which cards these are is data, so the row waits rather than showing four
  // decisive destinations that then become four different cards.
  it("holds the row with skeletons while the to-do is still loading", () => {
    const { container } = renderActions(undefined)
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0)
    expect(screen.queryAllByRole("link")).toHaveLength(0)
    // Still four slots, so nothing moves when the real cards arrive.
    expect(container.querySelectorAll('[data-slot="card"]')).toHaveLength(4)
  })

  // The burst points at work. Over placeholders it would be pointing at
  // nothing.
  it("throws no confetti while the row is still loading", () => {
    const { container } = renderActions(undefined)
    expect(
      container.querySelectorAll('[data-testid="success-confetti"]')
    ).toHaveLength(0)
  })
})
