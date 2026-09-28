import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { precioSegunCantidad, type EscalaPrecio } from "./precios-mayor"

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

type LineaConPrecio = { producto_id: string; cantidad: number; precio_unitario: number }

// T2 (PLAN_6): el precio unitario no puede quedar por debajo del precio del
// sistema para esa cantidad (el normal, o el por mayor de la escala alcanzada).
// Devuelve el mensaje de error o null. La BD lo vuelve a exigir (fn_precio_minimo,
// script 41); esto es para dar un mensaje claro antes de llegar ahí.
export async function validarPrecioMinimo(
  supabase: SupabaseClient,
  lineas: LineaConPrecio[]
): Promise<string | null> {
  const ids = Array.from(new Set(lineas.map((l) => l.producto_id)))
  if (ids.length === 0) return null

  const [{ data: productos, error }, escalas] = await Promise.all([
    supabase.from("productos").select("id, codigo, precio").in("id", ids),
    escalasVigentesPorProducto(supabase, ids),
  ])
  if (error) return "No se pudieron verificar los precios del sistema."

  const porId = new Map((productos ?? []).map((p) => [p.id as string, p]))
  const centavos = (n: number) => Math.round(n * 100)
  for (const l of lineas) {
    const prod = porId.get(l.producto_id)
    if (!prod) return "Uno de los productos ya no existe."
    const minimo = precioSegunCantidad(Number(prod.precio), escalas.get(l.producto_id), l.cantidad)
    if (centavos(l.precio_unitario) < centavos(minimo)) {
      return `El precio de ${prod.codigo} no puede ser menor a Bs ${minimo.toFixed(2)} (precio del sistema para ${l.cantidad} u.).`
    }
  }
  return null
}
