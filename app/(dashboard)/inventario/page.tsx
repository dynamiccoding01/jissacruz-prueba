import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import {
  InventarioExplorer,
  type DesgloseSucursal,
  type ProductoInventario,
} from "./inventario-explorer"

// Fila cruda de producto_stock_sucursal con la sucursal embebida (PostgREST).
type FilaStockSucursal = {
  producto_id: string
  stock_actual: number
  sucursal: { codigo: string; nombre: string } | null
}

export default async function InventarioPage() {
  const perfil = await getPerfil()
  const supabase = await createClient()

  const { data } = await supabase
    .from("productos")
    .select("id, codigo, descripcion, linea_marca, stock_actual, stock_minimo")
    .eq("activo", true)
    .order("descripcion")

  // Stock por sucursal (C2 · paso 3b). Si las tablas de sucursales aún no
  // existen en esta base (migraciones 12–14 sin correr), estas consultas
  // devuelven error → data null → la UI degrada a modo una-sola-sucursal.
  const [{ data: sucursales }, { data: stockPorSucursal }] = await Promise.all([
    supabase.from("sucursales").select("id").eq("activo", true),
    supabase
      .from("producto_stock_sucursal")
      .select("producto_id, stock_actual, sucursal:sucursales(codigo, nombre)"),
  ])

  // Solo tiene sentido mostrar el desglose si hay más de una sucursal.
  const multisucursal = (sucursales?.length ?? 0) > 1

  const desglosePorProducto = new Map<string, DesgloseSucursal[]>()
  if (multisucursal) {
    // PostgREST tipa el embed como array aunque en tiempo de ejecución la
    // relación (sucursal_id → sucursales) es a-uno y devuelve un objeto.
    const filas = (stockPorSucursal ?? []) as unknown as FilaStockSucursal[]
    for (const fila of filas) {
      if (!fila.sucursal) continue
      const lista = desglosePorProducto.get(fila.producto_id) ?? []
      lista.push({
        codigo: fila.sucursal.codigo,
        nombre: fila.sucursal.nombre,
        stock: fila.stock_actual,
      })
      desglosePorProducto.set(fila.producto_id, lista)
    }
    desglosePorProducto.forEach((lista) => {
      lista.sort((a, b) => a.codigo.localeCompare(b.codigo, "es", { numeric: true }))
    })
  }

  const productos = ((data ?? []) as ProductoInventario[]).map((p) => ({
    ...p,
    desglose: desglosePorProducto.get(p.id) ?? [],
  }))

  return (
    <InventarioExplorer
      productos={productos}
      rol={perfil!.rol}
      multisucursal={multisucursal}
    />
  )
}
