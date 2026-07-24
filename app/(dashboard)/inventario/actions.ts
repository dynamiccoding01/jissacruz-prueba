"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { ajusteStockSchema, type AjusteStockInput } from "@/lib/validations/inventario"

// Reutiliza fn_buscar_productos (misma RPC que catalogo, compras, ventas y
// proformas — no reimplementar el filtro en el cliente) y le agrega el stock
// por sucursal, que la RPC no devuelve (retorna setof productos).
export async function searchProductosInventario(query: string, campos: string[] = []) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) {
    logError("inventario.searchProductosInventario", error, { query, campos })
    return []
  }

  const filas = (data ?? []) as Array<{
    id: string
    codigo: string
    descripcion: string
    linea_marca: string | null
    stock_actual: number
    stock_minimo: number
  }>
  if (filas.length === 0) return []

  const { data: stockData, error: stockError } = await supabase
    .from("producto_stock_sucursal")
    .select("producto_id, stock_actual, sucursales (codigo, nombre)")
    .in(
      "producto_id",
      filas.map((f) => f.id)
    )
  if (stockError) {
    logError("inventario.searchProductosInventario.stock", stockError, { query })
  }

  const porProducto = new Map<string, Array<{ stock_actual: number; sucursales: unknown }>>()
  for (const s of stockData ?? []) {
    const lista = porProducto.get(s.producto_id) ?? []
    lista.push({ stock_actual: s.stock_actual, sucursales: s.sucursales })
    porProducto.set(s.producto_id, lista)
  }

  return filas.map((f) => ({
    id: f.id,
    codigo: f.codigo,
    descripcion: f.descripcion,
    linea_marca: f.linea_marca,
    stock_actual: f.stock_actual,
    stock_minimo: f.stock_minimo,
    producto_stock_sucursal: porProducto.get(f.id) ?? [],
  }))
}

export async function ajustarStock(productoId: string, values: AjusteStockInput) {
  const parsed = ajusteStockSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del ajuste." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_ajuste_stock", {
    p_producto_id: productoId,
    p_cantidad: parsed.data.cantidad,
    p_tipo: parsed.data.tipo,
    p_motivo: parsed.data.motivo,
    p_costo_unitario: parsed.data.costo_unitario ?? null,
  })

  if (error) {
    logError("inventario.ajustarStock", error, { productoId, tipo: parsed.data.tipo })
    return { error: error.message }
  }

  revalidatePath("/inventario")
  revalidatePath("/kardex")
  return { success: true }
}
