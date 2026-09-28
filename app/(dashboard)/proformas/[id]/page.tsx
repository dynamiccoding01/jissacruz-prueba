import { notFound } from "next/navigation"

import { requireRol } from "@/lib/auth/session"
import { obtenerProformaDetalle } from "../actions"
import { ProformaDetalleView } from "./proforma-detalle"

export default async function ProformaDetallePage({ params }: { params: { id: string } }) {
  await requireRol(["admin", "vendedor"])
  const detalle = await obtenerProformaDetalle(params.id)
  if (!detalle) notFound()

  return <ProformaDetalleView detalle={detalle} />
}
