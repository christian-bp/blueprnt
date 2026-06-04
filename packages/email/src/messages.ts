import da from "@workspace/i18n/messages/da"
import en from "@workspace/i18n/messages/en"
import fi from "@workspace/i18n/messages/fi"
import nb from "@workspace/i18n/messages/nb"
import sv from "@workspace/i18n/messages/sv"

export const EMAIL_LOCALES = ["en", "sv", "nb", "da", "fi"] as const
export type EmailLocale = (typeof EMAIL_LOCALES)[number]

const all = { da, en, fi, nb, sv }

export type EmailMessages = (typeof en)["email"]

// Unknown locales fall back to English (the base locale).
export function emailMessages(locale: string): EmailMessages {
  if ((EMAIL_LOCALES as readonly string[]).includes(locale)) {
    return all[locale as EmailLocale].email
  }
  return en.email
}

export function fillTemplate(
  text: string,
  params: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => params[key] ?? "")
}
