"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { ventaSchema, normalizarDescuento, type VentaInput } from "@/lib/validations/venta"

export type ProductoBusqueda = {
  id: string
  codigo: string
  descripcion: string
  precio: number
}

export async function buscarProductosParaVenta(query: string): Promise<ProductoBusqueda[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", { p_query: query })
  if (error) return []
  return ((data ?? []) as { id: string; codigo: string; descripcion: string; precio: number }[]).map(
    (p) => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion, precio: Number(p.precio) })
  )
}

export async function registrarVenta(values: VentaInput) {
  const parsed = ventaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la venta." }
  }
  const v = parsed.data

  const supabase = await createClient()

  const payload = {
    cliente_id: v.cliente_id || null,
    proforma_origen_id: null,
    descuento_tipo: normalizarDescuento(v.descuento_tipo),
    descuento_valor: v.descuento_valor,
    impuesto_porcentaje: v.impuesto_porcentaje,
    items: v.items.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      descuento_tipo: normalizarDescuento(item.descuento_tipo),
      descuento_valor: item.descuento_valor,
    })),
  }

  const { data: ventaId, error } = await supabase.rpc("fn_registrar_venta", { p_venta: payload })
  if (error) {
    return { error: error.message || "No se pudo registrar la venta." }
  }

  const { data: venta } = await supabase.from("ventas").select("numero").eq("id", ventaId).single()

  revalidatePath("/ventas")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  revalidatePath("/productos")
  return { id: ventaId as string, numero: venta?.numero as string | undefined }
}
