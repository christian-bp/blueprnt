import type { useTranslations } from "next-intl"

// The next-intl translator scoped to the shared validation namespace. Schema
// factories take this so Zod messages stay in i18n. The form passes
// useTranslations("dashboard.validation") straight in.
//
// Note: this validates the message KEY (and the namespace) at compile time, but
// next-intl v4 does NOT type per-message ICU arguments. A parameterized message
// like minLength ("...at least {min} characters.") needs its {min} passed by
// hand (t("minLength", { min })); a missing param is not a compile error, so
// factories must supply required params themselves.
export type ValidationT = ReturnType<
  typeof useTranslations<"dashboard.validation">
>
