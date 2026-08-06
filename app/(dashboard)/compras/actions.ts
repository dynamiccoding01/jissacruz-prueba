"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { datosBusquedaPorProducto } from "@/lib/producto-busqueda-server"
import { ultimoCostoPorProducto } from "@/lib/costos-server"
import type { Medida } from "@/lib/medidas"
import { getPerfil } from "@/lib/auth/session"
import { ordenCompraSchema, type OrdenCompraInput } from "@/lib/validations/compra"

// Sprint 6: mismo contrato que la búsqueda de proforma — suma unidad, medidas y
// códigos originales (OEM) para poder mostrarlos en los resultados.
export type ProductoBusquedaCompra = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  medidas: Medida[]
  originales: string[]
  // Referencias para no cargar el costo a ciegas: precio de VENTA actual del
  // producto y último costo al que se compró (null si nunca se compró).
  precio: number
  ultimoCosto: number | null
}

export async function buscarProductosParaCompra(
  query: string,
  campos: string[] = []
): Promise<ProductoBusquedaCompra[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) {
    logError("compras.buscarProductosParaCompra", error, { query, campos })
    return []
  }

  const filas = (data ?? []) as {
    id: string
    codigo: string
    descripcion: string
    unidad_medida: string
    precio: number
  }[]
  const ids = filas.map((p) => p.id)
  const [datos, costos] = await Promise.all([
    datosBusquedaPorProducto(supabase, ids),
    ultimoCostoPorProducto(supabase, ids),
  ])
  return filas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    unidad: p.unidad_medida,
    medidas: datos.get(p.id)?.medidas ?? [],
    originales: datos.get(p.id)?.originales ?? [],
    precio: Number(p.precio ?? 0),
    ultimoCosto: costos.get(p.id) ?? null,
  }))
}

export async function createOrdenCompra(values: OrdenCompraInput) {
  const parsed = ordenCompraSchema.safeParse(values)
  if (!parsed.success) {
    // El caso más común es el precio de venta por debajo del costo: se devuelve
    // el mensaje del schema para que el usuario sepa qué corregir.
    return { error: parsed.error.issues[0]?.message ?? "Revisá los datos de la orden." }
  }

  const supabase = await createClient()
  const perfil = await getPerfil()

  const { data: orden, error } = await supabase
    .from("ordenes_compra")
    .insert({
      proveedor_id: parsed.data.proveedor_id,
      notas: parsed.data.notas || null,
      creado_por: perfil?.id,
      // Sucursal destino = la del usuario que crea la orden (C2 · paso 3c).
      // La recepción (fn_recibir_orden_compra) hará entrar el stock aquí.
      sucursal_id: perfil?.sucursal_id ?? null,
    })
    .select("id")
    .single()

  if (error || !orden) {
    logError("compras.createOrdenCompra", error)
    return { error: "No se pudo crear la orden de compra." }
  }

  const { error: itemsError } = await supabase.from("orden_compra_items").insert(
    parsed.data.items.map((item) => ({
      orden_compra_id: orden.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      costo_unitario: item.costo_unitario,
      // Se aplica a productos.precio recién al recibir la orden (script 32).
      precio_venta: item.precio_venta,
    }))
  )

  if (itemsError) {
    logError("compras.createOrdenCompra.items", itemsError, { ordenId: orden.id })
    return { error: "No se pudieron guardar los ítems de la orden." }
  }

  revalidatePath("/compras")
  return { id: orden.id }
}

export async function recibirOrdenCompra(ordenId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_recibir_orden_compra", { p_orden_id: ordenId })
  if (error) {
    logError("compras.recibirOrdenCompra", error, { ordenId })
    return { error: error.message }
  }

  revalidatePath("/compras")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  revalidatePath("/productos")
  return { success: true }
}
