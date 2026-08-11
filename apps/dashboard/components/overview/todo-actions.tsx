"use client"

import {
  Briefcase01Icon,
  ChartColumnIcon,
  Layers01Icon,
  Tag01Icon,
  Tick02Icon,
  UserGroup03Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useTranslations } from "next-intl"
import { type ReactNode, useEffect, useState } from "react"
import { ActionCard, ActionCardSkeleton } from "@/components/action-card"
import { ConfettiBurst } from "@/components/confetti-burst"
import { useOrganization } from "@/components/org-context"
import type { Todo, TodoGroup, TodoGroupKey } from "@/lib/todo"

// Where each kind of outstanding work is done. Total over the group keys, so
// a new to-do group cannot ship without a destination.
const GROUP_HREF: Record<TodoGroupKey, string> = {
  importPeople: "/people/import",
  classifyPeople: "/people/classify",
  describeRoles: "/roles",
  evaluateRoles: "/roles",
  documentCriteria: "/model/method",
  approveCriteria: "/model/method",
  startPayMapping: "/pay-mappings",
}

const GROUP_ICONS: Record<TodoGroupKey, IconSvgElement> = {
  importPeople: UserGroup03Icon,
  classifyPeople: Tag01Icon,
  describeRoles: Briefcase01Icon,
  evaluateRoles: Briefcase01Icon,
  documentCriteria: Layers01Icon,
  approveCriteria: Tick02Icon,
  startPayMapping: ChartColumnIcon,
}

// The row holds one line of cards. buildTodo already emits its groups in
// priority order (import, classify, describe, evaluate, document, approve,
// start the mapping), so the first four ARE the four most pressing things.
const MAX_CARDS = 4

// Which companies have already had their burst this session. Module-level, so
// returning to the dashboard does not throw it again; a reload starts a new
// session and it fires once more, which is the point: it is an arrival
// effect, not an achievement.
//
// Per COMPANY, not one flag for the app. A single flag meant the first
// company to show work consumed the only burst there was, so switching
// company never celebrated again, and neither did finishing onboarding for a
// new company (the previous company's dashboard had already spent it). Each
// company arrives once.
const burstShownFor = new Set<string>()

// The four surfaces a fresh org most often jumps to, used to pad the row
// out when there is less outstanding work than it holds: the same domain
// icons, as plain destinations.
const SHORTCUTS: {
  key: "importEmployees" | "classify" | "roles" | "startPayMapping"
  href: string
  icon: IconSvgElement
}[] = [
  { key: "importEmployees", href: "/people/import", icon: UserGroup03Icon },
  { key: "classify", href: "/people/classify", icon: Tag01Icon },
  { key: "roles", href: "/roles", icon: Briefcase01Icon },
  { key: "startPayMapping", href: "/pay-mappings", icon: ChartColumnIcon },
]

// The dashboard's To do row: what to do next, as action cards.
//
// It replaced a section of expandable panels that listed the individual
// items (this role, that person). Every one of those rows led to a surface
// that lists them better, so the dashboard was carrying a second copy of
// four registers. What a front page owes the reader is the shortlist and the
// way in; the count says how much is waiting.
//
// The row always fills to MAX_CARDS: outstanding work first, then standing
// destinations to pad it, so the top of the dashboard is never a band with
// one card and three holes. What separates the two kinds is the card, not a
// second heading: work carries the brand chip and a COUNT of what is
// waiting, a plain destination carries a muted chip and a description of
// where it goes. A second heading would spend a whole band saying what the
// chip already says, and would leave an empty "To do" band on a fresh org.
//
// The band's own heading follows the cards for the same reason: see
// TodoSection.
//
// While the query is still in flight the row is skeletons, not the standing
// destinations: which cards these are is data, and showing four decisive
// cards that then become four different ones reads as the page changing its
// mind. The confetti hangs off the same moment, so it cannot fire over
// placeholder content either.
export function TodoActions({ todo }: { todo: Todo | undefined }) {
  const t = useTranslations("dashboard.overview")
  const tQuick = useTranslations("dashboard.overview.quickActions")
  const { orgId } = useOrganization()
  const groups = todo?.groups ?? []

  // Fires once per company, when its row first has work to point at. The
  // to-do query resolves after the first paint, so this cannot be read at
  // mount: it has to wait for the moment the cards actually appear.
  const [celebrating, setCelebrating] = useState<string | null>(null)
  useEffect(() => {
    if (burstShownFor.has(orgId) || groups.length === 0) return
    burstShownFor.add(orgId)
    setCelebrating(orgId)
  }, [orgId, groups.length])
  // Compared against the current company rather than held as a bare boolean:
  // switching company keeps this component mounted, so a plain flag would
  // leave the new company's row wearing the old one's burst.
  const celebrate = celebrating === orgId

  // Until the query lands nobody knows WHICH cards these are, so the row
  // holds its shape with skeletons rather than showing standing destinations
  // that then turn into different cards. Same count, same measurements: the
  // row does not move when the real ones arrive.
  if (todo === undefined) {
    return (
      <TodoSection label={null}>
        {Array.from({ length: MAX_CARDS }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder, order is stable
          <ActionCardSkeleton key={index} />
        ))}
      </TodoSection>
    )
  }

  const work = groups.slice(0, MAX_CARDS).map((group) => ({
    key: group.key,
    href: GROUP_HREF[group.key],
    icon: GROUP_ICONS[group.key],
    title: t(`todo.groups.${group.key}`),
    description: groupDetail(group, t),
    tone: "brand" as const,
  }))
  // Deduplicated by destination: a group whose work happens on /roles has
  // already put that surface on the row, and the same card twice reads as a
  // bug rather than as emphasis.
  const taken = new Set(work.map((card) => card.href))
  const links = SHORTCUTS.filter((shortcut) => !taken.has(shortcut.href)).map(
    (shortcut) => ({
      key: shortcut.key,
      href: shortcut.href,
      icon: shortcut.icon,
      title: tQuick(`${shortcut.key}.label`),
      description: tQuick(`${shortcut.key}.detail`),
      tone: "muted" as const,
    })
  )

  return (
    <TodoSection
      label={work.length > 0 ? t("sectionTodo") : t("sectionQuickActions")}
    >
      {[...work, ...links].slice(0, MAX_CARDS).map((card, index) => (
        // The burst is a SIBLING of the card, not a child: a Card clips its
        // overflow, so confetti thrown inside one is cut off at its edge in a
        // straight line. The wrapper is the positioned parent it throws from
        // and nothing clips it.
        //
        // Keyed by SLOT, not by the card in it. The row is always four slots
        // and the to-do query keeps pushing while an org's data settles, so
        // keying by card would remount the wrapper every time a group's
        // membership changed and restart the burst from its first frame,
        // which reads as a flicker that never finishes.
        // biome-ignore lint/suspicious/noArrayIndexKey: the slot IS the identity here
        <div key={index} className="relative">
          {/* BEFORE the card, so the card paints over it. That is the whole
              clipping mechanism: the card is opaque, so no piece is ever
              visible INSIDE its bounds, and what shows is only what has
              cleared the edge. No mask, no overflow rule, nothing to keep in
              sync with the card's size or its rounded corners.

              It only works with an edge origin. Behind + center was built and
              rejected: the card swallowed the first half of every flight, so
              the burst surfaced late and weak. Launching at the rim means a
              piece is outside from its first frame and only the half still
              overlapping the card is hidden. Do not reorder these two, and do
              not move the origin back to center without moving this too.

              Every work card, and only the first time THIS COMPANY's row
              shows work this session: the burst marks WHICH of the four cards
              are waiting on the reader, so lighting one of three would point
              at the wrong thing. Never the padding links, which are not
              work.

              Staggered along the row so it reads as one sweep rather than
              four simultaneous pops, and a small spread keeps the pieces
              around each card instead of across the dashboard. */}
          {card.tone === "brand" && (
            <ConfettiBurst
              active={celebrate}
              delay={index * 0.09}
              spread={0.45}
              origin="edges"
              intensity="soft"
            />
          )}
          <ActionCard
            title={card.title}
            description={card.description}
            icon={card.icon}
            href={card.href}
            tone={card.tone}
          />
        </div>
      ))}
    </TodoSection>
  )
}

// The band's frame: its heading and the row of slots. Shared by the loading
// and loaded branches, so the grid is declared once and the two states cannot
// measure differently.
//
// The heading is not a constant. "To do" is only true while something is
// waiting, and a settled org's row is four standing destinations, so a fixed
// "To do" would tell a reader who has finished everything that they still
// have work outstanding. The label therefore follows the cards, and the band
// keeps its heading either way: four cards with no label above them read as
// loose page furniture rather than one group, and dropping the line entirely
// would move the whole row up the moment the query lands.
function TodoSection({
  label,
  children,
}: {
  label: string | null
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4">
      {label === null ? (
        // Which of the two this band is, is data. It holds the heading's line
        // rather than guessing "To do" and renaming itself a moment later,
        // which reads as the page changing its mind exactly as four cards
        // turning into four others would. h-5 is text-sm's line box and the
        // bar is centred in it, so the row below does not move on arrival.
        <div className="flex h-5 items-center">
          <Skeleton className="h-4 w-20" />
        </div>
      ) : (
        <h2 className="font-medium text-sm">{label}</h2>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  )
}

// A group's card says how much is waiting. The two single-row groups
// (importing people, starting the mapping) are not a quantity, so they name
// the act instead of counting to one.
function groupDetail(
  group: TodoGroup,
  t: ReturnType<typeof useTranslations<"dashboard.overview">>
): string {
  switch (group.key) {
    case "importPeople":
      return t("todo.importPeopleItem")
    case "startPayMapping":
      return t("todo.startPayMappingItem")
    case "classifyPeople":
      return t("todo.classifyPeopleCount", { count: group.count })
    default:
      return t("todo.groupCount", { count: group.count })
  }
}
