import { redirect } from "next/navigation"

// The organization section opens on the General tab.
export default function OrganizationPage() {
  redirect("/organization/general")
}
