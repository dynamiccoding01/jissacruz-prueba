import { requireRol } from "@/lib/auth/session"
import { ProformaForm } from "../proforma-form"

export default async function NuevaProformaPage() {
  await requireRol(["admin", "vendedor"])
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Nueva proforma</h1>
      <ProformaForm />
    </div>
  )
}
