"use client"

import { useEffect } from "react"

// A cold load of /docs/<slug>#<anchor> (a pasted or bookmarked deep link, or
// a reload) reaches the browser before the streamed article has rendered its
// headings, so the native hash jump finds no target and the reader lands at
// the top of the page instead of the section they asked for. Client-side
// navigation within the app already lands correctly; this only re-runs the
// jump the browser could not make, and only while the page is still at the
// top, so it never fights a reader who has already scrolled.
export function DocsHashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id === "" || window.scrollY > 0) return
    document.getElementById(id)?.scrollIntoView()
  }, [])
  return null
}
