import type sv from "../messages/sv.json"
import type { routing } from "./routing"

type Messages = typeof sv

declare module "next-intl" {
  interface AppConfig {
    Messages: Messages
    Locale: (typeof routing.locales)[number]
  }
}
