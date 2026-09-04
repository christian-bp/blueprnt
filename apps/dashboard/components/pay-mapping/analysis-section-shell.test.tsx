import { cleanup, render, screen } from "@testing-library/react"
import messages from "@workspace/i18n/messages/en.json"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  usePathname: () => "/pay-mappings/pay-2026/analysis/equal-work",
}))
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}))

const queue = {
  progress: {
    overall: { done: 12, total: 31 },
    praxis: { done: 4, total: 4 },
    equalWork: { done: 5, total: 5 },
    equivalentWork: { done: 0, total: 21 },
    collaborationDone: true,
  },
}
vi.mock("@/components/pay-mapping/pay-mapping-run-context", () => ({
  usePayMappingRun: () => ({ queue }),
}))

import { PageBreadcrumbRow } from "@/components/page-breadcrumb-row"
import { BreadcrumbSlotProvider } from "@/components/page-breadcrumb-slots"
import { AnalysisSectionShell } from "@/components/pay-mapping/analysis-section-shell"

const m = messages.dashboard.payMapping

function renderShell() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BreadcrumbSlotProvider>
        <PageBreadcrumbRow segments={[{ label: m.tabs.analysis }]} />
        <AnalysisSectionShell>
          <p>chapter body</p>
        </AnalysisSectionShell>
      </BreadcrumbSlotProvider>
    </NextIntlClientProvider>
  )
}

afterEach(cleanup)

describe("AnalysisSectionShell", () => {
  // The section had a title of its own that said "Documented", beside a page
  // already titled Analysis: two headings for one thing. It is gone, and what
  // it carried moved to the page title it was always about.
  it("puts its help and its instrument on the page's own Analysis title", () => {
    const { container } = renderShell()
    const header = container.querySelector("header") as HTMLElement
    const heading = screen.getByRole("heading", { name: m.tabs.analysis })
    expect(header.contains(heading)).toBe(true)
    // The instrument, announcing the whole mapping's WORK: 12 of 31 steps.
    const bar = screen.getByRole("progressbar", {
      name: m.analysis.progressBarLabel,
    })
    expect(header.contains(bar)).toBe(true)
    expect(bar.getAttribute("aria-valuenow")).toBe("39")
    // The chapter's statutory duty rides the trail, beside the crumb that
    // names the chapter, rather than repeating on each of its steps.
    expect(
      header.contains(
        screen.getByRole("button", {
          name: messages.dashboard.payMapping.analysis.duty.equalWork,
        })
      )
    ).toBe(true)
    expect(screen.getByText("chapter body")).toBeDefined()
  })

  // Drift pin: no second heading anywhere in the section, and specifically
  // not the one that named its subject.
  it("renders no heading of its own", () => {
    renderShell()
    expect(screen.getAllByRole("heading")).toHaveLength(1)
    expect(screen.queryByText("Documented")).toBeNull()
  })

  // THE TAB ROW IS GONE: the chapters navigate from the run sidebar, so the
  // shell's only nav is the breadcrumb trail. And no action band either: no
  // analysis chapter carries an action, so the band was a held strip of air
  // above every chapter's content. Both pinned as absences so neither can
  // creep back beside the sidebar.
  it("draws no chapter tab row and no action band", () => {
    const { container } = renderShell()
    expect(screen.getAllByRole("navigation")).toHaveLength(1)
    expect(container.querySelector('[data-slot="chapter-action"]')).toBeNull()
  })

  // The journey's continuation, the model section's own rule: the pinned
  // pathname is equal-work and the fixture's equalWork queue is finished, so
  // the page ends by naming Likvärdigt arbete; the unfinished chapter ahead
  // of it must never be offered from an unfinished one.
  it("offers the next chapter once the open chapter's work is done", () => {
    renderShell()
    const link = screen.getByRole("link", {
      name: m.journey.nextCta.replace(
        "{chapter}",
        m.review.chaptersShort.equivalentWork
      ),
    })
    expect(link.getAttribute("href")).toBe(
      "/pay-mappings/pay-2026/analysis/equivalent-work"
    )
  })

  it("offers no continuation while the open chapter's work remains", () => {
    queue.progress.equalWork = { done: 3, total: 5 }
    try {
      renderShell()
      expect(
        screen.queryByRole("link", {
          name: m.journey.nextCta.replace(
            "{chapter}",
            m.review.chaptersShort.equivalentWork
          ),
        })
      ).toBeNull()
    } finally {
      queue.progress.equalWork = { done: 5, total: 5 }
    }
  })
})
