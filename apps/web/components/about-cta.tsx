import { useTranslations } from "next-intl"

// Closing CTA for the about page. Lighter than the shared ContactCta (no
// gradient overlay, no badge): the about page already has heavy brand
// presence above, so this section just invites contact with a clear headline
// and the mailto link. Hover uses color only (no layout shift per CLAUDE.md).
export function AboutCta() {
  const t = useTranslations("web.about.cta")
  const email = useTranslations("web.contact")("email")

  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="mb-6 font-display font-extrabold text-5xl leading-[1.05] tracking-tight md:text-6xl">
          {t("heading")}
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-muted-foreground text-xl">
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
