"use client"

import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"
import { Spinner } from "@workspace/ui/components/spinner"
import { type Ref, type RefCallback, useEffect, useRef } from "react"

// The 6-digit code field shared by 2FA setup and the sign-in challenge. The
// slots are far larger than the shadcn default (size-9), because entering the
// code is the primary action on these screens.
//
// The size is responsive for a hard reason, not for taste: polyform's 60px
// slot is the target look, and six of them plus their borders are ~363px,
// which does not fit a 375px phone once the screen's own padding is taken
// off, so the field would scroll sideways. size-12 up to sm keeps it whole
// there; sm and up takes the full 60px (size-15) and the larger radius that
// comes with it. One place owns the sizing for both screens.
export function OtpField(props: {
  value: string
  onChange: (value: string) => void
  onComplete: (value: string) => void
  ariaLabel: string
  inputRef?: Ref<HTMLInputElement>
  autoFocus?: boolean
  // While true, the code is being verified: the slots stay mounted but
  // disabled and fade far back (see the containerClassName below), and a
  // padded status card floats centered on top. Disabling the library's real
  // input also clears its paste selection, which used to paint ghost digits
  // over the overlay.
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
    // Tracks the slot height at both breakpoints: this box is what the
    // verifying overlay is positioned against (inset-0), so a fixed height
    // would leave the card floating over part of a taller field.
    <div className="relative h-12 sm:h-15">
      <InputOTP
        ref={setRefs}
        maxLength={6}
        value={props.value}
        onChange={props.onChange}
        onComplete={props.onComplete}
        autoFocus={props.autoFocus}
        aria-label={props.ariaLabel}
        disabled={props.verifying === true}
        // The status card floats over the slots, so while verifying the field
        // must recede instead of reading through it: shadcn's disabled dim
        // (opacity-50) leaves the digits and borders competing with the card,
        // so we override that one variant down to a ghost. The transition
        // makes the fade (and the fade back on a failed verify) a movement
        // rather than a flicker; the disabled state is what drives it, so the
        // class is static and no second condition can drift from `verifying`.
        containerClassName="transition-opacity duration-200 has-disabled:opacity-20"
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }).map((_, i) => (
            <InputOTPSlot
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
              key={i}
              index={i}
              className="size-12 text-lg sm:size-15 sm:text-xl"
            />
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
