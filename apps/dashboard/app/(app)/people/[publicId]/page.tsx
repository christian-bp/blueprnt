"use client"

import { use } from "react"
import { PersonDetail } from "@/components/people/person-detail"

export default function PersonPage(props: {
  params: Promise<{ publicId: string }>
}) {
  const { publicId } = use(props.params)
  return <PersonDetail publicId={publicId} />
}
