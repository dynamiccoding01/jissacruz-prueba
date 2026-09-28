import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

// T4 (PLAN_6): un pedido del POS o una proforma es TODO con factura o TODO S/F
// (productos.con_factura). Devuelve el mensaje de error o null. La BD lo vuelve
// a exigir (script 43); esto da el mensaje antes de llegar ahí.
export async function validarSinMezclaFactura(
  supabase: SupabaseClient,
  productoIds: string[],
  documento: "pedido" | "proforma"
): Promise<string | null> {
  const ids = Array.from(new Set(productoIds))
  if (ids.length < 2) return null

  const { data, error } = await supabase.from("productos").select("con_factura").in("id", ids)
  if (error) return "No se pudo verificar si los productos son con o sin factura."

  const tipos = new Set((data ?? []).map((p) => p.con_factura !== false))
  if (tipos.size > 1) {
    const articulo = documento === "pedido" ? "Un pedido" : "Una proforma"
    return `${articulo} no puede mezclar productos con factura y sin factura (S/F). Hacé uno aparte para los S/F.`
  }
  return null
}
