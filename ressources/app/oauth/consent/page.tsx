import { Suspense } from "react"
import { ConsentForm } from "./consent-form"

export const dynamic = "force-dynamic"

export default function ConsentPage() {
  return (
    <Suspense>
      <ConsentForm />
    </Suspense>
  )
}
