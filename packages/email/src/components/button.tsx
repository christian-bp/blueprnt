import { Button as ReactEmailButton, Section } from "@react-email/components"
import type React from "react"
import { colors } from "./theme"

// Centered call-to-action. Brand rose is a deliberate email-only exception to the
// app's neutral-primary rule (recorded in the design spec).
export function CtaButton({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  return (
    <Section className="my-[32px] text-center">
      <ReactEmailButton
        href={href}
        className="rounded-[10px] px-[20px] py-[12px] font-semibold text-[14px] no-underline"
        style={{
          backgroundColor: colors.brand,
          color: colors.brandForeground,
        }}
      >
        {children}
      </ReactEmailButton>
    </Section>
  )
}
