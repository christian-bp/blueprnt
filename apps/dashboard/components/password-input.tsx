"use client"

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Input } from "@workspace/ui/components/input"
import { cn } from "@workspace/ui/lib/utils"
import { useTranslations } from "next-intl"
import { type ComponentProps, useState } from "react"

// A password field with a show/hide toggle. Wraps the shadcn Input; the toggle
// sits in a fixed-size slot so revealing the value never reflows (only the icon
// swaps). All Input/field props are forwarded to the inner input, including the
// FormControl-injected id/aria-invalid/aria-describedby and the react-hook-form
// ref, so it drops into FormControl exactly like a plain Input; the wrapper div
// is inert. `type` is owned here, so it is not accepted as a prop.
export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const t = useTranslations("dashboard.auth")
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-9", className)}
        {...props}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50"
      >
        <HugeiconsIcon
          icon={visible ? ViewOffIcon : ViewIcon}
          size={16}
          strokeWidth={2}
          aria-hidden
        />
      </button>
    </div>
  )
}
