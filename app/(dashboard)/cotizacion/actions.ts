"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import type { EscalaPrecio } from "@/lib/precios-mayor"
import { escalasVigentesPorProducto } from "@/lib/precios-mayor-server"
import { datosBusquedaPorProducto } from "@/lib/producto-busqueda-server"
import type { Medida } from "@/lib/medidas"

// Cotización: buscar productos SOLO para cotizar precios. No mira stock (se puede
// cotizar cualquier producto), no descuenta nada, no guarda nada. Misma búsqueda
// que el resto (reusa fn_buscar_productos + escalas por mayor + medidas/OEM).
export type ProductoCotizacion = {
  id: string
  codigo: string
  descripcion: string
  precio: number
  escalas: EscalaPrecio[]
  unidad: string
  medidas: Medida[]
  originales: string[]
}

export async function buscarProductosParaCotizacion(
  query: string,
  campos: string[] = []
): Promise<ProductoCotizacion[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) {
    logError("cotizacion.buscarProductosParaCotizacion", error, { query, campos })
    return []
  }

  const filas = (data ?? []) as {
    id: string
    codigo: string
    descripcion: string
    precio: number
    unidad_medida: string
  }[]
  const ids = filas.map((p) => p.id)
  const [escalas, datos] = await Promise.all([
    escalasVigentesPorProducto(supabase, ids),
    datosBusquedaPorProducto(supabase, ids),
  ])
  return filas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    precio: Number(p.precio),
    escalas: escalas.get(p.id) ?? [],
    unidad: p.unidad_medida,
    medidas: datos.get(p.id)?.medidas ?? [],
    originales: datos.get(p.id)?.originales ?? [],
  }))
}
