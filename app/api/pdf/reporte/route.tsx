import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { generarReporte, type Periodo, type ReporteTipo } from "@/lib/reportes"
import { getLogoEmpresa } from "@/lib/pdf/logo"
import { ReporteDocument } from "@/lib/pdf/reporte-document"

const TIPOS: ReporteTipo[] = ["ventas", "proformas", "mas_vendidos", "inventario"]

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tipoParam = searchParams.get("tipo") ?? "ventas"
  const tipo = (TIPOS.includes(tipoParam as ReporteTipo) ? tipoParam : "ventas") as ReporteTipo

  const reporte = await generarReporte(tipo, {
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined,
    periodo: (searchParams.get("periodo") as Periodo | null) ?? undefined,
  })

  const supabase = await createClient()
  const { data: empresa } = await supabase
    .from("configuracion_empresa")
    .select("nombre, nit")
    .eq("id", 1)
    .single()

  const buffer = await renderToBuffer(
    <ReporteDocument
      empresa={empresa ?? { nombre: "JISSACRUZ", nit: null }}
      reporte={reporte}
      logo={getLogoEmpresa()}
    />
  )

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="reporte-${tipo}.pdf"`,
    },
  })
}
