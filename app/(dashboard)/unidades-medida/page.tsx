import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { UnidadesExplorer, type UnidadFila } from "./unidades-explorer"

export default async function UnidadesMedidaPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("unidades_medida")
    .select("id, codigo, nombre, abreviatura")
    .eq("activo", true)
    .order("nombre")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Unidades de medida</h1>
        <p className="text-sm text-muted-foreground">
          Catálogo de unidades (Pieza, Docena, Juego…). Cada producto se vende en su unidad; no hay
          conversión entre unidades.
        </p>
      </div>
      <UnidadesExplorer unidades={(data ?? []) as UnidadFila[]} />
    </div>
  )
}
