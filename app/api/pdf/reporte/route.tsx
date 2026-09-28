import { renderToBuffer } from "@react-pdf/renderer"
import { NextRequest, NextResponse } from "next/server"

import { getPerfil } from "@/lib/auth/session"
import { getConfiguracionEmpresa } from "@/lib/datos-cacheados"
import { generarReporte, type Periodo, type ReporteTipo } from "@/lib/reportes"
import { getLogoEmpresa } from "@/lib/pdf/logo"
import { ReporteDocument } from "@/lib/pdf/reporte-document"

const TIPOS: ReporteTipo[] = ["ventas", "proformas", "mas_vendidos", "inventario", "rentabilidad"]

export async function GET(request: NextRequest) {
  // Los reportes son solo admin (la pantalla ya lo exige; la ruta del PDF también,
  // porque incluye costos y utilidades).
  const perfil = await getPerfil()
  if (!perfil || !perfil.activo || perfil.rol !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const tipoParam = searchParams.get("tipo") ?? "ventas"
  const tipo = (TIPOS.includes(tipoParam as ReporteTipo) ? tipoParam : "ventas") as ReporteTipo

  const reporte = await generarReporte(tipo, {
    desde: searchParams.get("desde") ?? undefined,
    hasta: searchParams.get("hasta") ?? undefined,
    periodo: (searchParams.get("periodo") as Periodo | null) ?? undefined,
  })

  const empresa = await getConfiguracionEmpresa()

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
