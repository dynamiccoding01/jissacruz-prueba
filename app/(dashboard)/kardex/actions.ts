"use server"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"

export type ProductoKardex = {
  id: string
  codigo: string
  descripcion: string
  linea_marca: string | null
  stock_actual: number
  stock_minimo: number
}

// PLAN_7 · T3: el Kardex es un módulo propio y tiene su buscador de producto.
// Reutiliza fn_buscar_productos (misma RPC que catálogo, inventario, ventas y
// proformas — no reimplementar el filtro en el cliente).
export async function buscarProductosParaKardex(
  query: string,
  campos: string[] = []
): Promise<ProductoKardex[]> {
  if (!query.trim()) return []

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) {
    logError("kardex.buscarProductosParaKardex", error, { query, campos })
    return []
  }

  return ((data ?? []) as ProductoKardex[]).map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    linea_marca: p.linea_marca,
    stock_actual: Number(p.stock_actual),
    stock_minimo: Number(p.stock_minimo),
  }))
}
