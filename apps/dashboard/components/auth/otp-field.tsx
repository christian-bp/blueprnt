"use client"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
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
}) {
  return (
    <InputOTP
      ref={props.inputRef}
      maxLength={6}
      value={props.value}
      onChange={props.onChange}
      onComplete={props.onComplete}
      autoFocus={props.autoFocus}
      aria-label={props.ariaLabel}
    >
      <InputOTPGroup>
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
          <InputOTPSlot key={i} index={i} className="size-12 text-xl" />
        ))}
      </InputOTPGroup>
    </InputOTP>
  )
}
