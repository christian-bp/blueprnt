import { useTranslations } from "next-intl"

// Shared closing section: the landing page and the how-it-works page both
// end on this contact band.
export function ContactCta() {
  const t = useTranslations("web.contact")
  const email = t("email")

  return (
    <section id="contact" className="relative overflow-hidden py-24 md:py-32">
      {/* Subtle gradient overlay; no hero-style glow blobs in this section. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-pop/10"
      />

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-pop/30 bg-pop/15 px-4 py-1.5 font-extrabold text-[11px] text-emerald-700 uppercase tracking-[0.2em]">
          <span className="size-1.5 rounded-full bg-pop" />
          {t("badge")}
        </div>
        <h2 className="mb-8 font-display font-extrabold text-5xl leading-[1.02] tracking-tight md:text-7xl">
          {t("heading")}
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-lg text-muted-foreground leading-relaxed md:text-xl">
          {t("lede")}
        </p>
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-4 rounded-3xl bg-foreground px-10 py-5 font-black text-background shadow-2xl shadow-zinc-200 transition-colors hover:bg-brand focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
        >
          <span>{email}</span>
          <svg
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </a>
      </div>
    </section>
  )
}
