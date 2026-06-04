import { getRequestConfig } from "next-intl/server"

export default getRequestConfig(async () => {
  const locale = "en"
  const messages = (await import("@workspace/i18n/messages/en.json")).default
  return { locale, messages }
})
