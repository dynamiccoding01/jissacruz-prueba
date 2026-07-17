import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { SucursalesExplorer, type SucursalFila } from "./sucursales-explorer"

export default async function SucursalesPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data } = await supabase
    .from("sucursales")
    .select("id, codigo, nombre, direccion, telefono")
    .eq("activo", true)
    .order("codigo")

  return <SucursalesExplorer sucursales={(data ?? []) as SucursalFila[]} />
}
