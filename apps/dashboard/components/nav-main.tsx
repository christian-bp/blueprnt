"use client"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"

// A nav entry is a leaf link. `match` lists extra path-prefixes that also mark
// it active (e.g. Work owns /roles as well as its own /work).
export type NavItem = {
  title: string
  url: string
  icon?: React.ReactNode
  match?: string[]
}

// Icons are 20px (size-5), so the collapsed button tightens its padding to
// p-1.5 to fit the glyph in the 32px icon-rail square (symmetric padding also
// centers it, no mx-auto needed). Everything else about the collapse, the
// centering and hiding the label, is intentionally left to the vendored
// SidebarMenuButton: it animates width/padding and truncates the label so the
// rail closes smoothly. Overriding with mx-auto / justify-center / [&_span]:hidden
// breaks that (the icon jumps to center and the text blanks instantly).
const RAIL_CLASSES = "group-data-[collapsible=icon]:p-1.5! [&_svg]:size-5"

// The active page reads as a tinted brand pill: brand ink (label AND glyph,
// which inherit currentColor) on a 10% brand wash, rather than a saturated
// fill. The fill competed with the page's own brand accents for attention and
// made the rest of the nav read as disabled; the wash marks position while
// leaving the emphasis to the content. data-active is set from isActive by
// SidebarMenuButton; these override its default sidebar-accent treatment for
// all three states (rest, hover, press), because leaving :active unhandled
// flashes the vendor's gray on click.
const ACTIVE_CLASSES =
  "data-active:bg-brand/10 data-active:text-brand data-active:hover:bg-brand/15 data-active:hover:text-brand data-active:active:bg-brand/15 data-active:active:text-brand"

// Primary navigation: flat leaf links under an optional group heading (the
// caller renders one NavMain per category, so the sidebar reads as labeled
// areas instead of one undifferentiated list). A leaf is active on an exact URL
// match or a sub-path (so /work does not match /workspace); the optional
// `match` prefixes extend that (Work is active across /work and /roles).
// Sub-navigation within a section lives in the header (SectionTabs), not here,
// so this stays a plain flat menu that reads identically in the expanded and
// collapsed rail: the heading fades out with the rail (the vendored
// SidebarGroupLabel handles that), leaving the glyphs aligned.
export function NavMain({
  items,
  label,
}: {
  items: NavItem[]
  label?: string
}) {
  const pathname = usePathname()
  const isActive = (url: string) =>
    url === "/"
      ? pathname === "/"
      : pathname === url || pathname.startsWith(`${url}/`)
  const itemActive = (item: NavItem) =>
    isActive(item.url) || (item.match?.some(isActive) ?? false)

  return (
    <SidebarGroup>
      {label === undefined ? null : (
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                isActive={itemActive(item)}
                tooltip={item.title}
                className={`${RAIL_CLASSES} ${ACTIVE_CLASSES}`}
                render={<Link href={item.url} />}
              >
                {item.icon}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
