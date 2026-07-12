import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { ComprasExplorer, type OrdenFila } from "./compras-explorer"

export default async function ComprasPage() {
  await requireAdmin()
  const supabase = await createClient()

  const [{ data: ordenes }, { data: proveedores }] = await Promise.all([
    supabase
      .from("ordenes_compra")
      .select(
        "id, estado, fecha_orden, fecha_recepcion, notas, proveedores(id, nombre), orden_compra_items(cantidad, costo_unitario, productos(codigo, descripcion))"
      )
      .order("fecha_orden", { ascending: false }),
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
  ])

  return (
    <ComprasExplorer
      ordenes={(ordenes ?? []) as unknown as OrdenFila[]}
      proveedores={proveedores ?? []}
    />
  )
}
