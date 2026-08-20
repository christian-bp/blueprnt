"use client"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SPRING } from "@/lib/motion"
import { isNavActive } from "@/lib/navigation"
import { deepestMatch } from "@/lib/section-pages"

// A sub-page link, revealed under its section entry while the section is open.
export type NavSubItem = {
  title: string
  url: string
}

// A nav entry is a section link. `match` lists extra path-prefixes that also
// mark it active (e.g. Work owns /roles as well as its own /work). `items`
// lists the section's sub-pages; they slide out under the entry only while
// the user is inside the section, so the rest of the time the menu stays a
// flat list.
export type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  match?: string[]
  items?: NavSubItem[]
}

// Icons are 20px (size-5), so the collapsed button tightens its padding to
// p-1.5 to fit the glyph in the 32px icon-rail square (symmetric padding also
// centers it, no mx-auto needed). Everything else about the collapse, the
// centering and hiding the label, is intentionally left to the vendored
// SidebarMenuButton: it animates width/padding and truncates the label so the
// rail closes smoothly. Overriding with mx-auto / justify-center / [&_span]:hidden
// breaks that (the icon jumps to center and the text blanks instantly).
// Exported so the footer's own destination row (NavFooter) collapses into the
// rail identically; a second copy of the string is how the two rows drift.
export const RAIL_CLASSES =
  "group-data-[collapsible=icon]:p-1.5! [&_svg]:size-5"

// The active page reads as a tinted brand pill: brand ink (label AND glyph,
// which inherit currentColor) on a 10% brand wash, rather than a saturated
// fill. The fill competed with the page's own brand accents for attention and
// made the rest of the nav read as disabled; the wash marks position while
// leaving the emphasis to the content. data-active is set from isActive by
// SidebarMenuButton; these override its default sidebar-accent treatment for
// all three states (rest, hover, press), because leaving :active unhandled
// flashes the vendor's gray on click. Sub-page buttons share the treatment
// (SidebarMenuSubButton sets the same data-active), so the section entry and
// the page within it are marked in one language.
export const ACTIVE_CLASSES =
  "data-active:bg-brand/10 data-active:text-brand data-active:hover:bg-brand/15 data-active:hover:text-brand data-active:active:bg-brand/15 data-active:active:text-brand"

// Primary navigation: section links under an optional group heading (the
// caller renders one NavMain per category, so the sidebar reads as labeled
// areas instead of one undifferentiated list). Which section is active follows
// isNavActive, shared with every other surface built from the navigation
// registry. A section's sub-pages (mirroring its header tabs) slide out under its entry
// while the section is open and collapse when the user leaves it, so only the
// current section ever shows its second level. In the collapsed icon rail the
// sub-list is hidden by the vendored SidebarMenuSub, leaving the glyph rail
// untouched.
export function NavMain({
  items,
  label,
}: {
  items: NavItem[]
  label?: string
}) {
  const pathname = usePathname()
  // The vendored sub-list hides itself in the icon rail with display:none,
  // which would snap the space closed under it; deriving `open` from the rail
  // state routes the rail toggle through the same exit/enter spring instead,
  // so the groups below glide while the rail animates its width. The mobile
  // sidebar is a sheet that never enters the icon state, but `state` still
  // tracks the desktop toggle there, so it must be ignored on mobile.
  const { state, isMobile } = useSidebar()
  const railCollapsed = !isMobile && state === "collapsed"
  const itemActive = (item: NavItem) =>
    isNavActive(pathname, item.url, item.match)

  return (
    <SidebarGroup>
      {label === undefined ? null : (
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = itemActive(item)
            const subs = item.items ?? []
            const open = active && subs.length > 0 && !railCollapsed
            // The active sub-page is the deepest matching link, so an index
            // sub-page (/model -> the build view) yields to its nested
            // siblings (/model/method) and a register's detail pages keep its
            // own tab active (/people/<id> -> People).
            const activeSub = open
              ? deepestMatch(
                  subs.map((sub) => sub.url),
                  pathname
                )
              : undefined
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={item.title}
                  className={`${RAIL_CLASSES} ${ACTIVE_CLASSES}`}
                  render={<Link href={item.url} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
                {/* The slide-out follows docs/ui-animation.md: the motion
                    element carries only animated geometry (height, opacity)
                    while the vendored SidebarMenuSub keeps its own padding and
                    border, so height 0 truly means zero; overflow-hidden only
                    clips mid-animation (nothing overlaps the box at rest); and
                    initial={false} renders a directly-loaded section already
                    expanded instead of replaying the entrance. */}
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="sub"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SPRING}
                      className="overflow-hidden"
                    >
                      {/* Deviation from the vendored default (mx-3.5 px-2.5):
                          the right inset is dropped so a sub-page's pill ends
                          flush with its section's pill. Hierarchy is read from
                          the left indent and rail; staggered right edges just
                          look ragged next to the brand washes, and the labels
                          get the 24px back before truncating. */}
                      <SidebarMenuSub className="mr-0 pr-0">
                        {subs.map((sub) => {
                          const subActive = sub.url === activeSub
                          return (
                            <SidebarMenuSubItem key={sub.url}>
                              <SidebarMenuSubButton
                                isActive={subActive}
                                className={ACTIVE_CLASSES}
                                render={
                                  <Link
                                    href={sub.url}
                                    aria-current={
                                      subActive ? "page" : undefined
                                    }
                                  />
                                }
                              >
                                <span>{sub.title}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </motion.div>
                  )}
                </AnimatePresence>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
