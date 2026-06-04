import type en from "../messages/en.json"
import type { routing } from "./routing"

type Messages = typeof en

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages
    Locale: (typeof routing.locales)[number]
  }
}
