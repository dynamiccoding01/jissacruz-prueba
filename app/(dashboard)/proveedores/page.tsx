import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { ProveedoresExplorer, type ProveedorFila } from "./proveedores-explorer"

export default async function ProveedoresPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("proveedores")
    .select("id, nombre, contacto, nit, direccion")
    .eq("activo", true)
    .order("nombre")

  return <ProveedoresExplorer proveedores={(data ?? []) as ProveedorFila[]} />
}
