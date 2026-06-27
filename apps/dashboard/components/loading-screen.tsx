import { Spinner } from "@workspace/ui/components/spinner"

// The full-screen, centered loader shown while a layout or gate resolves (auth,
// mandatory 2FA, onboarding status). Brand-colored; keeps the default Spinner
// size. Inline spinners (buttons, panels) keep the default treatment for their
// context.
export function LoadingScreen(props: { label: string }) {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Spinner aria-label={props.label} className="text-brand" />
    </main>
  )
}
