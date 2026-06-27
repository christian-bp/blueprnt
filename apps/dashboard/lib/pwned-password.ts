// Best-effort client-side breached-password check via the Have I Been Pwned
// k-anonymity range API: only the first 5 chars of the password's SHA-1 ever
// leave the browser, never the password itself. We run this BEFORE submitting a
// password reset so a breached password is rejected up front, because Better
// Auth consumes the one-time reset token before its own server-side breach
// check runs (so a rejected submit would otherwise burn the link). The server
// haveIBeenPwned plugin stays the authority; this is purely UX. On any failure
// we fail OPEN (return false) and let the server decide.
export async function isPasswordPwned(password: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode(password)
    )
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
    if (!res.ok) return false
    const body = await res.text()
    return body
      .split("\n")
      .some((line) => line.split(":")[0]?.trim() === suffix)
  } catch {
    return false
  }
}
