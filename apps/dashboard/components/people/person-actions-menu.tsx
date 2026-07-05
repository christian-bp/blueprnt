"use client"

import { MoreHorizontalIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { Id } from "@workspace/backend/convex/_generated/dataModel"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { ErasePersonControl } from "@/components/people/erase-person-control"

// The person page's unified actions menu: a single "..." trigger in the page
// header (same anatomy as FamilyActionsMenu) holding the person lifecycle
// actions. Today that is the GDPR erasure, as a destructive item opening the
// type-to-confirm dialog.
export function PersonActionsMenu({
  personId,
  displayName,
  externalRef,
}: {
  personId: Id<"people">
  displayName: string
  externalRef: string | null
}) {
  const t = useTranslations("dashboard.people")
  const [eraseOpen, setEraseOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t("detail.actionsMenu")}
            className="shrink-0"
          >
            <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setEraseOpen(true)}
          >
            {t("erase.trigger")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ErasePersonControl
        open={eraseOpen}
        onOpenChange={setEraseOpen}
        personId={personId}
        displayName={displayName}
        externalRef={externalRef}
      />
    </>
  )
}
