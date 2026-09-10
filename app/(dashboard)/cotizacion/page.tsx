import { createClient } from "@/lib/supabase/server"
import { CotizacionesExplorer, type CotizacionFila } from "./cotizaciones-explorer"

export default async function CotizacionPage() {
  const supabase = await createClient()

  const [{ data: cotizaciones }, { data: clientes }] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select("id, numero, creado_en, total, clientes(id, nombre)")
      .order("creado_en", { ascending: false }),
    supabase.from("clientes").select("id, nombre").order("nombre"),
  ])

  return (
    <CotizacionesExplorer
      cotizaciones={(cotizaciones ?? []) as unknown as CotizacionFila[]}
      clientes={clientes ?? []}
    />
  )
}
