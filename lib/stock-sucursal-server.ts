import "server-only"

import type { createClient } from "@/lib/supabase/server"

// Stock por producto en una sucursal dada (o total entre sucursales si no hay
// sucursal asignada). Se usa para limitar/avisar la cantidad según el stock en
// POS, Proforma y Cotización (PLAN_5 · T1/T2). El POS ya trae su propio desglose
// para el <StockBadge/>; este helper es la versión mínima (solo el número).
export async function stockSucursalPorProducto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
  sucursalId: string | null
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (ids.length === 0) return out

  const { data } = await supabase
    .from("producto_stock_sucursal")
    .select("producto_id, sucursal_id, stock_actual")
    .in("producto_id", ids)

  for (const r of (data ?? []) as {
    producto_id: string
    sucursal_id: string
    stock_actual: number
  }[]) {
    if (sucursalId) {
      if (r.sucursal_id === sucursalId) out.set(r.producto_id, Number(r.stock_actual))
    } else {
      out.set(r.producto_id, (out.get(r.producto_id) ?? 0) + Number(r.stock_actual))
    }
  }
  return out
}
