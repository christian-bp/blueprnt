import { ImportWizard } from "@/components/people/import/import-wizard"

// Full-screen takeover, like the onboarding wizard. The wizard's AuthShell is a
// h-svh frame, so inside the app shell's padded content column it gets squished;
// a fixed, full-viewport layer lets it fill the screen and cover the
// sidebar/header (z-10/z-20). It stays inside AppShell's React tree, so the
// wizard's steps keep the OrganizationProvider context (orgId) they need. Exit
// is the wizard's own "back to people" control (the shell nav is hidden here).
// overflow-hidden clips any sub-pixel svh/inset mismatch; the wizard's own
// <main> handles internal scrolling via AuthShell.
export default function ImportPage() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <ImportWizard />
    </div>
  )
}
