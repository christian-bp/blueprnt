"use client"

import { api } from "@workspace/backend/convex/_generated/api"
import type enMessages from "@workspace/i18n/messages/en.json"
import { type Locale, TIME_ZONE } from "@workspace/i18n/routing"
import { useQuery } from "convex/react"
import { NextIntlClientProvider } from "next-intl"
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  resolveUiLocale,
} from "@/lib/locale"

// en.json is the source locale; the parity test guarantees every other bundle
// has the same shape, so loaded bundles are cast to this type for the typed
// NextIntlClientProvider.
type Messages = typeof enMessages

// A loaded message bundle keyed by locale. The JSON import resolves to a wider
// type than Messages; the cast is safe because parity guards the shape.
type Loader = () => Promise<{ default: Messages }>

// Dynamic importers per supported locale. Keeping them in a literal map keeps
// each import statically analysable and avoids a template-literal import.
const LOADERS: Record<Locale, Loader> = {
  en: () =>
    import("@workspace/i18n/messages/en.json") as Promise<{
      default: Messages
    }>,
  sv: () =>
    import("@workspace/i18n/messages/sv.json") as Promise<{
      default: Messages
    }>,
  nb: () =>
    import("@workspace/i18n/messages/nb.json") as Promise<{
      default: Messages
    }>,
  da: () =>
    import("@workspace/i18n/messages/da.json") as Promise<{
      default: Messages
    }>,
  fi: () =>
    import("@workspace/i18n/messages/fi.json") as Promise<{
      default: Messages
    }>,
}

// Module-level cache so a locale's bundle is fetched at most once per session.
const cache = new Map<Locale, Messages>()

function setLocaleCookie(locale: Locale): void {
  // Direct document.cookie write is intentional: the Cookie Store API the
  // linter suggests is not yet broadly supported and adds async complexity for
  // this fire-and-forget, last-known-locale write.
  // biome-ignore lint/suspicious/noDocumentCookie: see comment above
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`
}

// Context that lets any descendant request a transient locale preview. The
// default is a no-op so consumers outside LocaleProvider (e.g. sign-in page)
// do not crash.
const LocalePreviewContext = createContext<(locale: string | null) => void>(
  () => {}
)

// Hook for components that need to trigger a locale preview. Safe to call
// anywhere; outside LocaleProvider the setter is a no-op.
export function useSetPreviewLocale(): (locale: string | null) => void {
  return useContext(LocalePreviewContext)
}

// Makes the dashboard UI language follow the resolution chain
// user locale -> organization default -> en, reactively. getUiLocale is a Convex
// subscription, so changing the default language in onboarding step 1
// re-renders the whole app in the new language. The locale cookie lets SSR
// serve the last-known language on reload (see i18n/request.ts).
//
// A preview locale can be set via useSetPreviewLocale() so the UI switches
// immediately on selection (before the Convex mutation and subscription
// round-trip). The preview is released automatically once the server-confirmed
// locale catches up to the preview value.
//
// Locale changes are rare, so the swap stays simple: while the target bundle
// loads we keep rendering the current one (no blank flash). Signed out, the
// query returns null and we stay on initialLocale/initialMessages.
export function LocaleProvider(props: {
  initialLocale: Locale
  initialMessages: Messages
  children: ReactNode
}) {
  // Transient preview locale set by UI before the server round-trip completes.
  const [previewLocale, setPreviewLocale] = useState<string | null>(null)

  const resolved = useQuery(api.accounts.onboarding.getUiLocale)

  // serverValue is the settled query result: null when signed out, undefined
  // while in-flight. Collapse undefined -> null for resolveUiLocale.
  const serverValue = resolved === undefined ? null : resolved

  // The server-confirmed locale (ignoring any preview).
  const resolvedServer = resolveUiLocale(serverValue, props.initialLocale)

  // Auto-release the preview once the server value has caught up. This uses
  // the adjust-state-during-render pattern (same as seededFor in
  // organization-setup-step.tsx): calling setState during render is safe when
  // guarded by a condition that will be false on the next render.
  if (previewLocale !== null && resolvedServer === previewLocale) {
    setPreviewLocale(null)
  }

  // Active locale: preview wins while set; otherwise use the server path.
  const target = resolveUiLocale(
    previewLocale ?? serverValue,
    props.initialLocale
  )

  const [active, setActive] = useState<{ locale: Locale; messages: Messages }>({
    locale: props.initialLocale,
    messages: props.initialMessages,
  })

  // Seed the cache with the bundle the server already sent us.
  if (!cache.has(props.initialLocale)) {
    cache.set(props.initialLocale, props.initialMessages)
  }

  useEffect(() => {
    // Persist only server-confirmed locales. Previews are transient and must
    // never survive a reload, so no cookie is written while one is active.
    // Once the preview clears (or never existed), the cookie follows the
    // server value; with no preview, target equals resolvedServer, so this
    // single write also covers the bundle-swap path below AND the case where
    // a preview already pre-switched the bundle (no swap happens, but the
    // cookie still needs the confirmed value).
    if (previewLocale === null) {
      setLocaleCookie(resolvedServer)
    }
    if (target === active.locale) return
    const cached = cache.get(target)
    if (cached !== undefined) {
      setActive({ locale: target, messages: cached })
      return
    }
    let canceled = false
    LOADERS[target]().then((mod) => {
      if (canceled) return
      cache.set(target, mod.default)
      setActive({ locale: target, messages: mod.default })
    })
    return () => {
      canceled = true
    }
  }, [target, active.locale, previewLocale, resolvedServer])

  return (
    <LocalePreviewContext value={setPreviewLocale}>
      <NextIntlClientProvider
        locale={active.locale}
        messages={active.messages}
        timeZone={TIME_ZONE}
      >
        {props.children}
      </NextIntlClientProvider>
    </LocalePreviewContext>
  )
}
