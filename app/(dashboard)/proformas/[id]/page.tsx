import { notFound } from "next/navigation"

import { obtenerProformaDetalle } from "../actions"
import { ProformaDetalleView } from "./proforma-detalle"

export default async function ProformaDetallePage({ params }: { params: { id: string } }) {
  const detalle = await obtenerProformaDetalle(params.id)
  if (!detalle) notFound()

  return <ProformaDetalleView detalle={detalle} />
}
