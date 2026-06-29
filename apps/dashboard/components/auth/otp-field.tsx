"use client"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from "@workspace/ui/lib/utils"
import type { Ref } from "react"

// The 6-digit code field shared by 2FA setup and the sign-in challenge. The
// slots are larger than the shadcn default (size-9), in the spirit of polyform's
// OTP, since entering the code is the primary action on these screens. size-12
// (not polyform's 60px) so six slots still fit the content column on phones
// without horizontal scroll. One place owns the sizing for both screens.
export function OtpField(props: {
  value: string
  onChange: (value: string) => void
  onComplete: (value: string) => void
  ariaLabel: string
  inputRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
  // While true, the code is being verified: the slots are hidden and a spinner
  // with the `verifyingLabel` takes their place, the way polyform's OTP shows its
  // verifying state. The overlay sits inside the field's own box (no layout
  // shift), and the input stays mounted so focus is preserved for a retry; the
  // parent's double-submit guard prevents a second verify.
  verifying?: boolean
  verifyingLabel?: string
}) {
  return (
    <div className="relative">
      <InputOTP
        ref={props.inputRef}
        maxLength={6}
        value={props.value}
        onChange={props.onChange}
        onComplete={props.onComplete}
        autoFocus={props.autoFocus}
        aria-label={props.ariaLabel}
      >
        <InputOTPGroup className={cn(props.verifying && "invisible")}>
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
            <InputOTPSlot key={i} index={i} className="size-12 text-xl" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {props.verifying && (
        <div className="absolute inset-0 flex items-center justify-center gap-2">
          <Spinner className="size-5" />
          {props.verifyingLabel && (
            <span className="text-muted-foreground text-sm">
              {props.verifyingLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
