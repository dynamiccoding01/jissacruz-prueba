"use server"

import { requireAdmin } from "@/lib/auth/session"
import { generarReporte, type Periodo, type ReporteResultado, type ReporteTipo } from "@/lib/reportes"

export async function obtenerReporte(
  tipo: ReporteTipo,
  params: { desde?: string; hasta?: string; periodo?: Periodo }
): Promise<ReporteResultado> {
  // Los reportes son solo-admin; el layout no filtra por rol.
  await requireAdmin()
  return generarReporte(tipo, params)
}
