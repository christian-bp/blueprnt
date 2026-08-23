import {
  Frame,
  FrameDescription,
  FrameFooter,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@workspace/ui/components/frame"
import { cn } from "@workspace/ui/lib/utils"
import type { ReactNode } from "react"

// The settings surfaces' shared anatomy (the Verve frame): a muted outer
// frame whose header names the section, a white inner panel of label/control
// rows, and the section's actions in the frame footer UNDER the panel. One
// composite so every settings section measures the same.
export function SettingsFrame({
  title,
  description,
  footer,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  // Right-aligned actions under the panel (cancel first, primary last).
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Frame spacing="sm" className={className}>
      <FrameHeader>
        <FrameTitle>{title}</FrameTitle>
        {description !== undefined && (
          <FrameDescription>{description}</FrameDescription>
        )}
      </FrameHeader>
      <FramePanel className="p-0">
        <div className="flex flex-col divide-y divide-border">{children}</div>
      </FramePanel>
      {/* Row, actions right: the vendored footer is a column, which would
          stretch a lone button to the panel's full width. */}
      {footer !== undefined && (
        <FrameFooter className="flex-row items-center justify-end gap-2">
          {footer}
        </FrameFooter>
      )}
    </Frame>
  )
}

// One setting's row: name + explanation in the left column, the control in
// the right. `label` is a ReactNode so a form row passes its own FormLabel
// (keeping the FormItem error wiring) while a read-only row passes plain
// text. Rows stack on narrow screens and sit side by side from sm up,
// mirroring Verve's field geometry (label column max-w-sm, control column
// max-w-[34rem]).
export function SettingsRow({
  label,
  description,
  align = "start",
  children,
}: {
  label: ReactNode
  description?: ReactNode
  // "center" for single-control rows (a switch, a select); "start" once the
  // control column is taller than the label block.
  align?: "start" | "center"
  children: ReactNode
}) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "flex w-full flex-col gap-4 px-5 py-4 sm:flex-row",
        align === "center" ? "sm:items-center" : "sm:items-start"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:max-w-sm">
        <div className="font-medium text-sm leading-snug">{label}</div>
        {description !== undefined && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[34rem]">
        {children}
      </div>
    </div>
  )
}
