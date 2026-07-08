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
  // While true, the code is being verified: the slots stay VISIBLE but
  // disabled (the entered code remains readable, dimmed via the group's
  // has-disabled style), and a padded status card floats centered on top.
  // Disabling the library's real input also clears its paste selection,
  // which used to paint ghost digits over the overlay.
  verifying?: boolean
  verifyingLabel?: string
}) {
  const innerRef = useRef<HTMLInputElement | null>(null)
  const prevVerifying = useRef(false)

  // Refocus after a failed verify: disabling the input drops focus, so when
  // verifying ends (true -> false) it must reclaim focus for the retry.
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
    <div className="relative h-12">
      <InputOTP
        ref={setRefs}
        maxLength={6}
        value={props.value}
        onChange={props.onChange}
        onComplete={props.onComplete}
        autoFocus={props.autoFocus}
        aria-label={props.ariaLabel}
        disabled={props.verifying === true}
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
            <InputOTPSlot key={i} index={i} className="size-12 text-xl" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {props.verifying === true && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-md border border-input bg-background/95 px-4 py-2 shadow-sm">
            <Spinner className="size-5" />
            {props.verifyingLabel && (
              <span className="font-medium text-foreground text-sm">
                {props.verifyingLabel}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
