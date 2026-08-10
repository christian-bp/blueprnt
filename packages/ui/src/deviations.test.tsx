import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Checkbox } from "@workspace/ui/components/checkbox"
import { EmptyMedia } from "@workspace/ui/components/empty"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

// The shadcn CLI overwrites every file under src/components, so our deliberate
// deviations live as patches in packages/ui/patches and are replayed by
// `bun run ui:update`. These tests assert the deviations themselves: a patch
// that stops applying is caught by the update script, but a deviation edited
// away by hand would otherwise reach production silently, which is exactly how
// the previous overwrite went unnoticed while the whole suite stayed green.
// Read `bun run ui:refresh-patches` and docs/superpowers/specs before changing
// any expectation here: a failure means a deviation is gone, not that the test
// is stale.

describe("vendored shadcn deviations", () => {
  afterEach(() => {
    cleanup()
  })

  it("avatar uses the theme radius, not a circle", () => {
    const { container } = render(<Avatar />)
    const root = container.querySelector("[data-slot=avatar]")
    expect(root?.className).toContain("rounded-md")
    expect(root?.className).not.toContain("rounded-full")
  })

  it("avatar exposes a brand variant that tints the ring and the fallback", () => {
    const { container } = render(
      <Avatar variant="brand">
        <AvatarFallback>BP</AvatarFallback>
      </Avatar>
    )
    const root = container.querySelector("[data-slot=avatar]")
    expect(root?.getAttribute("data-variant")).toBe("brand")
    expect(root?.className).toContain("data-[variant=brand]:after:border-brand")

    const fallback = container.querySelector("[data-slot=avatar-fallback]")
    expect(fallback?.className).toContain(
      "group-data-[variant=brand]/avatar:text-brand"
    )
  })

  it("badge has a success variant", () => {
    const { container } = render(<Badge variant="success">Delivered</Badge>)
    const badge = container.querySelector("[data-slot=badge]")
    expect(badge?.className).toContain("text-success")
  })

  it("the empty state's icon media is brand-tinted, not neutral", () => {
    const { container } = render(
      <EmptyMedia variant="icon">
        <span>icon</span>
      </EmptyMedia>
    )
    const media = container.querySelector("[data-slot=empty-icon]")
    expect(media?.className).toContain("bg-brand/10")
    expect(media?.className).not.toContain("bg-muted")
  })

  it("checkbox fills the box in the indeterminate state", () => {
    const { container } = render(<Checkbox indeterminate />)
    const root = container.querySelector("[data-slot=checkbox]")
    // Base UI never stamps data-checked while indeterminate, so the fill has to
    // key off data-indeterminate or the mixed state reads as "none selected".
    expect(root?.getAttribute("data-indeterminate")).not.toBeNull()
    expect(root?.className).toContain("data-indeterminate:bg-primary")
  })

  it("checkbox swaps the tick for a minus while indeterminate", () => {
    const indeterminate = render(<Checkbox indeterminate />)
    const mixed = indeterminate.container.querySelector(
      "[data-slot=checkbox-indicator] svg"
    )
    cleanup()

    const checked = render(<Checkbox checked />)
    const tick = checked.container.querySelector(
      "[data-slot=checkbox-indicator] svg"
    )

    expect(mixed).not.toBeNull()
    expect(tick).not.toBeNull()
    expect(mixed?.innerHTML).not.toBe(tick?.innerHTML)
  })

  it("the select popup is sized to its content, not to the trigger", () => {
    const { baseElement } = render(
      <Select open>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A rather long option label</SelectItem>
        </SelectContent>
      </Select>
    )
    const popup = baseElement.querySelector("[data-slot=select-content]")
    expect(popup?.className).toContain("w-max")
    expect(popup?.className).toContain("min-w-(--anchor-width)")
  })

  it("the select trigger may shrink inside a form grid", () => {
    const { container } = render(
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
      </Select>
    )
    const trigger = container.querySelector("[data-slot=select-trigger]")
    expect(trigger?.className).toContain("min-w-0")
  })

  it("the dropdown popup is sized to its content, not to the trigger", () => {
    const { baseElement } = render(
      <DropdownMenu open>
        <DropdownMenuTrigger>trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>A rather long item label</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const popup = baseElement.querySelector("[data-slot=dropdown-menu-content]")
    expect(popup?.className).toContain("w-max")
    expect(popup?.className).not.toContain(" w-(--anchor-width)")
  })

  it("the tooltip draws no arrow by default and one when asked", () => {
    const withoutArrow = render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>trigger</TooltipTrigger>
          <TooltipContent>hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
    expect(screen.getByText("hint")).toBeDefined()
    const bare = withoutArrow.baseElement.querySelectorAll(
      "[data-slot=tooltip-content] > *"
    ).length
    cleanup()

    const withArrow = render(
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>trigger</TooltipTrigger>
          <TooltipContent arrow>hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
    const arrowed = withArrow.baseElement.querySelectorAll(
      "[data-slot=tooltip-content] > *"
    ).length

    expect(arrowed).toBe(bare + 1)
  })
})
