import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"

import type { Medida } from "@/lib/medidas"

// Enriquece los resultados de búsqueda con medidas y códigos originales (Sprint 6
// · Fase 4). Mismo patrón que escalasVigentesPorProducto: una consulta por los
// ids devueltos, para meterla en el Promise.all del action (no en serie).
export type DatosBusquedaProducto = { medidas: Medida[]; originales: string[] }

type MedidaRow = { producto_id: string; etiqueta: string; valor: number; unidad: string }
type OriginalRow = { producto_id: string; codigo_original: string }

export async function datosBusquedaPorProducto(
  supabase: SupabaseClient,
  ids: string[]
): Promise<Map<string, DatosBusquedaProducto>> {
  const mapa = new Map<string, DatosBusquedaProducto>()
  if (ids.length === 0) return mapa

  const [medidasRes, originalesRes] = await Promise.all([
    supabase
      .from("producto_medidas")
      .select("producto_id, etiqueta, valor, unidad, orden")
      .in("producto_id", ids)
      .order("orden"),
    supabase
      .from("producto_codigos_originales")
      .select("producto_id, codigo_original")
      .in("producto_id", ids),
  ])

  const get = (id: string): DatosBusquedaProducto => {
    const d = mapa.get(id) ?? { medidas: [], originales: [] }
    mapa.set(id, d)
    return d
  }

  for (const r of (medidasRes.data ?? []) as unknown as MedidaRow[]) {
    get(r.producto_id).medidas.push({
      etiqueta: r.etiqueta,
      valor: Number(r.valor),
      unidad: r.unidad,
    })
  }
  for (const r of (originalesRes.data ?? []) as unknown as OriginalRow[]) {
    get(r.producto_id).originales.push(r.codigo_original)
  }

  return mapa
}
