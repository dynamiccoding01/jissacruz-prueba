import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

// Último costo de compra por producto: el `costo_unitario` de la entrada de
// compra más reciente en el kardex. `productos` no guarda costo (solo `precio`,
// que es el de VENTA), así que el único lugar donde vive es el kardex.
//
// Se usa como referencia al armar una orden de compra: sin esto el campo "Costo
// Bs" arranca en 0 y sin ningún dato a la vista, que fue exactamente como
// entraron costos inventados (y de ahí los márgenes negativos).
//
// Mismo patrón que datosBusquedaPorProducto: una consulta por los ids devueltos.
export async function ultimoCostoPorProducto(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>()
  if (ids.length === 0) return mapa

  const { data } = await supabase
    .from("kardex_movimientos")
    .select("producto_id, costo_unitario, consecutivo")
    .in("producto_id", ids)
    .eq("tipo_movimiento", "entrada_compra")
    .order("consecutivo", { ascending: false })

  // Vienen ordenados de más nuevo a más viejo: la primera aparición de cada
  // producto es su último costo.
  for (const r of (data ?? []) as unknown as { producto_id: string; costo_unitario: number }[]) {
    if (!mapa.has(r.producto_id)) mapa.set(r.producto_id, Number(r.costo_unitario))
  }
  return mapa
}

// Último costo de UN producto. Devuelve null si nunca se compró.
export async function ultimoCostoDeProducto(
  supabase: SupabaseClient,
  productoId: string
): Promise<number | null> {
  const { data } = await supabase
    .from("kardex_movimientos")
    .select("costo_unitario")
    .eq("producto_id", productoId)
    .eq("tipo_movimiento", "entrada_compra")
    .order("consecutivo", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data ? Number((data as { costo_unitario: number }).costo_unitario) : null
}
