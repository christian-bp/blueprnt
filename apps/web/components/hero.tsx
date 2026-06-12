import Image from "next/image"
import { useTranslations } from "next-intl"

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"

export function Hero() {
  const t = useTranslations("web.hero")
  const tContact = useTranslations("web.contact")

  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-24 md:pt-20 md:pb-28">
      {/* Decorative glow blobs behind the grid; inert for pointer and AT. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 right-0 -mt-32 -mr-32 size-[28rem] rounded-full bg-brand/10 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 -mb-32 -ml-32 size-[28rem] rounded-full bg-pop/15 blur-[120px]"
      />

      <div className="relative mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-pop/30 bg-pop/15 px-4 py-1.5 font-extrabold text-[11px] text-emerald-700 uppercase tracking-[0.2em]">
              <span className="size-1.5 rounded-full bg-pop" />
              {t("badge")}
            </div>
            <h1 className="font-display font-extrabold text-5xl text-foreground leading-[1.02] tracking-tight md:text-7xl">
              {t("titleLead")}{" "}
              <span className="bg-gradient-to-r from-brand to-orange-400 bg-clip-text text-transparent">
                {t("titleAccent")}
              </span>
            </h1>
            <p className="max-w-xl font-medium text-lg text-muted-foreground leading-relaxed md:text-xl">
              {t("lede")}
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href={`mailto:${tContact("email")}`}
                className={`rounded-2xl bg-brand px-8 py-4 font-bold text-brand-foreground shadow-rose-200 shadow-xl transition-[translate] duration-300 hover:-translate-y-0.5 ${FOCUS_RING}`}
              >
                {t("ctaPrimary")}
              </a>
              <a
                href="#framework"
                className={`rounded-2xl border-2 border-hairline bg-background px-8 py-4 font-bold text-foreground transition-colors hover:border-brand/40 ${FOCUS_RING}`}
              >
                {t("ctaSecondary")}
              </a>
            </div>
          </div>
          <div className="relative">
            <Image
              src="/hero-architecture.png"
              alt={t("imageAlt")}
              width={1024}
              height={1024}
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="aspect-[6/5] w-full object-contain [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_85%)]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
