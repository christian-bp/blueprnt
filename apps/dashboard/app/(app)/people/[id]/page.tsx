"use client"

import { use } from "react"
import { PersonDetail } from "@/components/people/person-detail"

export default function PersonPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params)
  return <PersonDetail personId={id} />
}
