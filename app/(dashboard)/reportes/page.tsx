import { requireAdmin } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { Separator } from "@/components/ui/separator"
import { generarReporte } from "@/lib/reportes"
import { ReportesExplorer } from "./reportes-explorer"
import { VentasHistorial, type VentaFila } from "./ventas-historial"

export default async function ReportesPage() {
  await requireAdmin()

  const supabase = await createClient()

  // Carga inicial de los reportes (ventas del mes por día) + el historial de
  // ventas, que se movió acá desde el módulo Ventas (T3).
  const [inicial, { data: ventas }, { data: clientes }] = await Promise.all([
    generarReporte("ventas", { periodo: "diario" }),
    supabase
      .from("ventas")
      .select("id, numero, creado_en, total, proforma_origen_id, clientes(id, nombre)")
      .order("creado_en", { ascending: false }),
    supabase.from("clientes").select("id, nombre").order("nombre"),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Reportes</h1>
      <ReportesExplorer inicial={inicial} />
      <Separator />
      <VentasHistorial
        ventas={(ventas ?? []) as unknown as VentaFila[]}
        clientes={clientes ?? []}
      />
    </div>
  )
}
