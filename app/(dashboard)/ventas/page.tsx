import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/server"
import { Pos } from "./pos"
import { VentasHistorial, type VentaFila } from "./ventas-historial"

export default async function VentasPage() {
  const supabase = await createClient()

  const [{ data: ventas }, { data: clientes }] = await Promise.all([
    supabase
      .from("ventas")
      .select("id, numero, creado_en, total, proforma_origen_id, clientes(id, nombre)")
      .order("creado_en", { ascending: false }),
    supabase.from("clientes").select("id, nombre").order("nombre"),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-4 text-lg font-semibold">Punto de venta</h1>
        <Pos clientes={clientes ?? []} />
      </div>
      <Separator />
      <VentasHistorial
        ventas={(ventas ?? []) as unknown as VentaFila[]}
        clientes={clientes ?? []}
      />
    </div>
  )
}
