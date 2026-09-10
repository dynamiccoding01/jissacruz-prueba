"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { getPerfil } from "@/lib/auth/session"
import type { EscalaPrecio } from "@/lib/precios-mayor"
import { escalasVigentesPorProducto } from "@/lib/precios-mayor-server"
import { datosBusquedaPorProducto } from "@/lib/producto-busqueda-server"
import type { Medida } from "@/lib/medidas"
import {
  cotizacionSchema,
  calcularTotales,
  calcularSubtotalLinea,
  normalizarDescuento,
  type CotizacionInput,
} from "@/lib/validations/cotizacion"

// Cotización: buscar productos para cotizar precios. No mira stock (se puede
// cotizar cualquier producto), no descuenta nada. Misma búsqueda que el resto
// (reusa fn_buscar_productos + escalas por mayor + medidas/OEM).
export type ProductoCotizacion = {
  id: string
  codigo: string
  descripcion: string
  precio: number
  escalas: EscalaPrecio[]
  unidad: string
  // T4 (PLAN_4): marca/línea del producto, para mostrarla en la cotización.
  linea_marca: string | null
  medidas: Medida[]
  originales: string[]
  con_factura: boolean
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

  // T5 (PLAN_3): la Cotización muestra ÚNICAMENTE productos SIN factura (S/F).
  const filas = ((data ?? []) as {
    id: string
    codigo: string
    descripcion: string
    precio: number
    unidad_medida: string
    linea_marca: string | null
    con_factura: boolean
  }[]).filter((p) => p.con_factura === false)
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
    linea_marca: p.linea_marca ?? null,
    medidas: datos.get(p.id)?.medidas ?? [],
    originales: datos.get(p.id)?.originales ?? [],
    con_factura: p.con_factura ?? true,
  }))
}

// T5 (PLAN_4): guarda la cotización (cabecera + ítems), como una proforma pero
// sin tocar stock. Cliente opcional. Totales calculados en el servidor.
export async function guardarCotizacion(values: CotizacionInput) {
  const parsed = cotizacionSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la cotización." }
  }
  const v = parsed.data

  const supabase = await createClient()
  const perfil = await getPerfil()

  const totales = calcularTotales(
    v.items,
    v.descuento_tipo,
    v.descuento_valor,
    v.impuesto_porcentaje
  )

  const { data: cotizacion, error } = await supabase
    .from("cotizaciones")
    .insert({
      cliente_id: v.cliente_id ? v.cliente_id : null,
      tipo_pago: v.tipo_pago || null,
      plazo_validez_dias: v.plazo_validez_dias,
      tiempo_entrega_dias: v.tiempo_entrega_dias > 0 ? v.tiempo_entrega_dias : null,
      glosa: v.glosa || null,
      subtotal: totales.subtotal,
      descuento_tipo: normalizarDescuento(v.descuento_tipo),
      descuento_valor: v.descuento_valor,
      impuesto_porcentaje: v.impuesto_porcentaje,
      total: totales.total,
      creado_por: perfil?.id,
      // Sucursal de emisión = la del usuario logueado.
      sucursal_id: perfil?.sucursal_id ?? null,
    })
    .select("id, numero")
    .single()

  if (error || !cotizacion) {
    logError("cotizacion.guardarCotizacion", error)
    return { error: "No se pudo guardar la cotización." }
  }

  const { error: itemsError } = await supabase.from("cotizacion_items").insert(
    v.items.map((item) => ({
      cotizacion_id: cotizacion.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      descuento_tipo: normalizarDescuento(item.descuento_tipo),
      descuento_valor: item.descuento_valor,
      subtotal_linea: calcularSubtotalLinea(
        item.cantidad,
        item.precio_unitario,
        item.descuento_tipo,
        item.descuento_valor
      ),
    }))
  )

  if (itemsError) {
    logError("cotizacion.guardarCotizacion.items", itemsError, { cotizacionId: cotizacion.id })
    // No dejar una cotización sin ítems.
    await supabase.from("cotizaciones").delete().eq("id", cotizacion.id)
    return { error: "No se pudieron guardar los ítems de la cotización." }
  }

  revalidatePath("/cotizacion")
  return { id: cotizacion.id as string, numero: cotizacion.numero as string }
}
