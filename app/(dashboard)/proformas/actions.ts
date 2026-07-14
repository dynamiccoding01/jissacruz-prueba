"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import {
  proformaSchema,
  calcularTotales,
  calcularSubtotalLinea,
  normalizarDescuento,
  type ProformaInput,
} from "@/lib/validations/proforma"

export type ProductoBusqueda = {
  id: string
  codigo: string
  descripcion: string
  precio: number
}

export async function buscarProductosParaProforma(
  query: string,
  campos: string[] = []
): Promise<ProductoBusqueda[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) return []
  return ((data ?? []) as { id: string; codigo: string; descripcion: string; precio: number }[]).map(
    (p) => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion, precio: Number(p.precio) })
  )
}

export async function createProforma(values: ProformaInput) {
  const parsed = proformaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la proforma." }
  }
  const v = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Totales calculados en el servidor: nunca se confía en los del cliente.
  const totales = calcularTotales(
    v.items,
    v.descuento_tipo,
    v.descuento_valor,
    v.impuesto_porcentaje
  )

  const { data: proforma, error } = await supabase
    .from("proformas")
    .insert({
      cliente_id: v.cliente_id,
      tipo_pago: v.tipo_pago || null,
      plazo_validez_dias: v.plazo_validez_dias,
      glosa: v.glosa || null,
      subtotal: totales.subtotal,
      descuento_tipo: normalizarDescuento(v.descuento_tipo),
      descuento_valor: v.descuento_valor,
      impuesto_porcentaje: v.impuesto_porcentaje,
      total: totales.total,
      creado_por: user?.id,
    })
    .select("id, numero")
    .single()

  if (error || !proforma) {
    return { error: "No se pudo crear la proforma." }
  }

  const { error: itemsError } = await supabase.from("proforma_items").insert(
    v.items.map((item) => ({
      proforma_id: proforma.id,
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
    // Deja la cabecera sin ítems: la borramos para no dejar una proforma vacía.
    await supabase.from("proformas").delete().eq("id", proforma.id)
    return { error: "No se pudieron guardar los ítems de la proforma." }
  }

  revalidatePath("/proformas")
  return { id: proforma.id, numero: proforma.numero as string }
}

export async function convertirProformaAVenta(proformaId: string) {
  const supabase = await createClient()

  const { data: ventaId, error } = await supabase.rpc("fn_convertir_proforma_a_venta", {
    p_proforma_id: proformaId,
  })
  if (error) {
    return { error: error.message || "No se pudo convertir la proforma en venta." }
  }

  const { data: venta } = await supabase.from("ventas").select("numero").eq("id", ventaId).single()

  revalidatePath("/proformas")
  revalidatePath("/ventas")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  revalidatePath("/productos")
  return { id: ventaId as string, numero: venta?.numero as string | undefined }
}
