import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { InventarioExplorer, type ProductoInventario } from "./inventario-explorer"

export default async function InventarioPage() {
  const perfil = await getPerfil()
  const supabase = await createClient()

  const { data } = await supabase
    .from("productos")
    .select(`
      id, codigo, descripcion, linea_marca, stock_actual, stock_minimo,
      producto_stock_sucursal (
        stock_actual,
        sucursales (codigo, nombre)
      )
    `)
    .eq("activo", true)
    .order("descripcion")

  return (
    <InventarioExplorer
      productos={(data ?? []) as unknown as ProductoInventario[]}
      rol={perfil!.rol}
    />
  )
}
