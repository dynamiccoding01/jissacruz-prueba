import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { EscalaPrecio } from "./precios-mayor"

// C3 · paso 2 — Trae las escalas de precio por mayor VIGENTES (vigente_hasta
// null o >= hoy) de un conjunto de productos, agrupadas por producto y
// ordenadas por cantidad_minima. Usado por las búsquedas de proforma y POS.
export async function escalasVigentesPorProducto(
  supabase: SupabaseClient,
  productoIds: string[]
): Promise<Map<string, EscalaPrecio[]>> {
  const porProducto = new Map<string, EscalaPrecio[]>()
  if (productoIds.length === 0) return porProducto

  const hoy = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from("producto_precios_mayor")
    .select("producto_id, cantidad_minima, precio, vigente_hasta")
    .in("producto_id", productoIds)
    .or(`vigente_hasta.is.null,vigente_hasta.gte.${hoy}`)
    .order("cantidad_minima")

  for (const e of data ?? []) {
    const lista = porProducto.get(e.producto_id) ?? []
    lista.push({ cantidad_minima: e.cantidad_minima, precio: Number(e.precio) })
    porProducto.set(e.producto_id, lista)
  }
  return porProducto
}
