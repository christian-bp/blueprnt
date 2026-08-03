import { RoleImportWizard } from "@/components/roles/import/role-import-wizard"

// Full-screen takeover, like the people import. The wizard's WizardShell is a
// h-svh frame, so inside the app shell's padded content column it gets
// squished; a fixed, full-viewport layer lets it fill the screen and cover the
// sidebar/header. It stays inside AppShell's React tree, so the wizard keeps
// the OrganizationProvider context (orgId) it needs. Exit is the wizard's own
// "back to roles" control (the shell nav is hidden here).
export default function RolesImportPage() {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <RoleImportWizard />
    </div>
  )
}
