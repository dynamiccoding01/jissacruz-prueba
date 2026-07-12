import { requireAdmin } from "@/lib/auth/session"
import { generarReporte } from "@/lib/reportes"
import { ReportesExplorer } from "./reportes-explorer"

export default async function ReportesPage() {
  await requireAdmin()

  // Carga inicial: ventas del mes en curso, agrupadas por día.
  const inicial = await generarReporte("ventas", { periodo: "diario" })

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold">Reportes</h1>
      <ReportesExplorer inicial={inicial} />
    </div>
  )
}
