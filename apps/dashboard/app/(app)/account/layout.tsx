import type { ReactNode } from "react"

// Layout for the account settings section (/account/profile, /account/security).
// The tab bar lives in the site header (AccountTabs); this layout only provides
// the narrow column that constrains the page content width.
export default function AccountLayout(props: { children: ReactNode }) {
  return <div className="w-full">{props.children}</div>
}
