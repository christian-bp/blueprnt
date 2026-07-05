"use client"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { type Ref, type RefCallback, useEffect, useRef } from "react"

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
  // While true, the code is being verified: the whole input is swapped out for
  // a bordered box with a spinner and the `verifyingLabel`, the way polyform's
  // OTP shows its verifying state. Swapped, not overlaid: the library's real
  // input paints the pasted code through visibility tricks (paste selection),
  // so nothing of it may stay mounted. The fixed-height wrapper keeps the
  // swap free of layout shift.
  verifying?: boolean
  verifyingLabel?: string
}) {
  const innerRef = useRef<HTMLInputElement | null>(null)
  const prevVerifying = useRef(false)

  // Refocus after a failed verify: the input unmounts while verifying, so when
  // it comes back (verifying true -> false) it must reclaim focus for the
  // retry (autoFocus only applies to the very first mount).
  useEffect(() => {
    if (prevVerifying.current && props.verifying !== true) {
      innerRef.current?.focus()
    }
    prevVerifying.current = props.verifying === true
  }, [props.verifying])

  const setRefs: RefCallback<HTMLInputElement> = (node) => {
    innerRef.current = node
    const ref = props.inputRef
    if (typeof ref === "function") {
      ref(node)
    } else if (ref != null) {
      ref.current = node
    }
  }

  return (
    <div className="h-12">
      {props.verifying === true ? (
        <div className="flex h-full w-full items-center justify-center gap-2 rounded-md border border-input bg-background/95">
          <Spinner className="size-5" />
          {props.verifyingLabel && (
            <span className="font-medium text-foreground text-sm">
              {props.verifyingLabel}
            </span>
          )}
        </div>
      ) : (
        <InputOTP
          ref={setRefs}
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
      )}
    </div>
  )
}
