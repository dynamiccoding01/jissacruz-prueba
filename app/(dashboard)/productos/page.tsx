import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { ProductosExplorer, type ProductoFila } from "./productos-explorer"

export default async function ProductosPage() {
  const perfil = await getPerfil()
  const supabase = await createClient()

  const { data } = await supabase
    .from("productos")
    .select(`
      id, codigo, descripcion, linea_marca, precio, stock_actual, stock_minimo, imagen_url,
      producto_stock_sucursal (
        stock_actual,
        sucursales (codigo, nombre)
      )
    `)
    .eq("activo", true)
    .order("descripcion")

  return (
    <ProductosExplorer
      productosIniciales={(data ?? []) as unknown as ProductoFila[]}
      rol={perfil!.rol}
    />
  )
}
