// input-otp 1.4.2 schedules three setTimeouts (0/10/50ms) on every mount (a
// Chrome autofill workaround) and never clears them on unmount. A fast test can
// finish before they fire; happy-dom then tears down `window` and the stray
// timer crashes React's scheduler with "window is not defined". Suites that
// mount an OTP field call this after unmount (in afterEach, once cleanup() has
// run) to drain the strays while `window` is still alive: 60ms outlasts the
// 50ms longest stray, and the event loop fires the strays before this timer
// regardless of machine load (it dequeues earlier-deadline timers first).
export function drainOtpMountTimers(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 60))
}
