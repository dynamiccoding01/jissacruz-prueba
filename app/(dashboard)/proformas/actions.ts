"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { getPerfil } from "@/lib/auth/session"
import type { EscalaPrecio } from "@/lib/precios-mayor"
import { escalasVigentesPorProducto } from "@/lib/precios-mayor-server"
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
  // C3: escalas de precio por mayor VIGENTES (filtradas por fecha en el
  // servidor), ordenadas por cantidad_minima ascendente.
  escalas: EscalaPrecio[]
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
  if (error) {
    logError("proformas.buscarProductosParaProforma", error, { query, campos })
    return []
  }

  const filas = (data ?? []) as { id: string; codigo: string; descripcion: string; precio: number }[]
  const escalas = await escalasVigentesPorProducto(
    supabase,
    filas.map((p) => p.id)
  )
  return filas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    precio: Number(p.precio),
    escalas: escalas.get(p.id) ?? [],
  }))
}

export async function createProforma(values: ProformaInput) {
  const parsed = proformaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la proforma." }
  }
  const v = parsed.data

  const supabase = await createClient()
  const perfil = await getPerfil()

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
      // P10: 0 (o vacío) significa "no indicar" -> null, sin leyenda en el PDF.
      tiempo_entrega_dias: v.tiempo_entrega_dias > 0 ? v.tiempo_entrega_dias : null,
      glosa: v.glosa || null,
      subtotal: totales.subtotal,
      descuento_tipo: normalizarDescuento(v.descuento_tipo),
      descuento_valor: v.descuento_valor,
      impuesto_porcentaje: v.impuesto_porcentaje,
      total: totales.total,
      creado_por: perfil?.id,
      // Sucursal de emisión = la del usuario logueado (C2 · paso 3c).
      sucursal_id: perfil?.sucursal_id ?? null,
    })
    .select("id, numero")
    .single()

  if (error || !proforma) {
    logError("proformas.createProforma", error)
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
    logError("proformas.createProforma.items", itemsError, { proformaId: proforma.id })
    // Deja la cabecera sin ítems: la borramos para no dejar una proforma vacía.
    await supabase.from("proformas").delete().eq("id", proforma.id)
    return { error: "No se pudieron guardar los ítems de la proforma." }
  }

  revalidatePath("/proformas")
  return { id: proforma.id, numero: proforma.numero as string }
}

// ---------- Parte IV: detalle, edición y revalidación ----------

export type EstadoEfectivo = "vigente" | "pendiente" | "vencida" | "convertida"

export type ProformaDetalleItem = {
  producto_id: string
  codigo: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  // Precio ACTUAL del producto, para comparar contra el de la proforma (Q23).
  precio_actual: number
  descuento_tipo: "ninguno" | "monto_fijo"
  descuento_valor: number
}

export type ProformaDetalle = {
  id: string
  numero: string
  creado_en: string
  estado: string
  estado_efectivo: EstadoEfectivo
  revalidada_en: string | null
  cliente_id: string
  cliente: { id: string; nombre: string; ci_nit: string | null; telefono: string | null } | null
  tipo_pago: string | null
  plazo_validez_dias: number
  tiempo_entrega_dias: number | null
  glosa: string | null
  descuento_tipo: "ninguno" | "monto_fijo"
  descuento_valor: number
  impuesto_porcentaje: number
  subtotal: number
  total: number
  items: ProformaDetalleItem[]
}

// El descuento en BD es null | 'porcentaje' | 'monto_fijo'. El formulario (tras
// F4) solo maneja 'ninguno' | 'monto_fijo'; un 'porcentaje' histórico se muestra
// como 'ninguno' al editar (el usuario está revisando precios de todos modos).
function descuentoParaFormulario(tipo: unknown): "ninguno" | "monto_fijo" {
  return tipo === "monto_fijo" ? "monto_fijo" : "ninguno"
}

export async function obtenerProformaDetalle(id: string): Promise<ProformaDetalle | null> {
  const supabase = await createClient()

  const { data: p, error } = await supabase
    .from("vista_proformas")
    .select(
      "id, numero, creado_en, estado, estado_efectivo, revalidada_en, cliente_id, tipo_pago, plazo_validez_dias, tiempo_entrega_dias, glosa, descuento_tipo, descuento_valor, impuesto_porcentaje, subtotal, total, clientes(id, nombre, ci_nit, telefono)"
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !p) {
    if (error) logError("proformas.obtenerProformaDetalle", error, { id })
    return null
  }

  const { data: items, error: itemsError } = await supabase
    .from("proforma_items")
    .select("producto_id, cantidad, precio_unitario, descuento_tipo, descuento_valor, productos(codigo, descripcion, precio)")
    .eq("proforma_id", id)

  if (itemsError) {
    logError("proformas.obtenerProformaDetalle.items", itemsError, { id })
    return null
  }

  const row = p as Record<string, unknown>
  const cliente = (row.clientes as ProformaDetalle["cliente"]) ?? null

  return {
    id: row.id as string,
    numero: row.numero as string,
    creado_en: row.creado_en as string,
    estado: row.estado as string,
    estado_efectivo: row.estado_efectivo as EstadoEfectivo,
    revalidada_en: (row.revalidada_en as string | null) ?? null,
    cliente_id: row.cliente_id as string,
    cliente,
    tipo_pago: (row.tipo_pago as string | null) ?? null,
    plazo_validez_dias: Number(row.plazo_validez_dias),
    tiempo_entrega_dias: row.tiempo_entrega_dias == null ? null : Number(row.tiempo_entrega_dias),
    glosa: (row.glosa as string | null) ?? null,
    descuento_tipo: descuentoParaFormulario(row.descuento_tipo),
    descuento_valor: Number(row.descuento_valor ?? 0),
    impuesto_porcentaje: Number(row.impuesto_porcentaje ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    total: Number(row.total ?? 0),
    items: (items ?? []).map((it) => {
      const prod = (it as Record<string, unknown>).productos as
        | { codigo: string; descripcion: string; precio: number }
        | null
      return {
        producto_id: it.producto_id as string,
        codigo: prod?.codigo ?? "—",
        descripcion: prod?.descripcion ?? "",
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        precio_actual: Number(prod?.precio ?? 0),
        descuento_tipo: descuentoParaFormulario(it.descuento_tipo),
        descuento_valor: Number(it.descuento_valor ?? 0),
      }
    }),
  }
}

// Estado efectivo actual leído de la vista (fuente única de verdad).
async function estadoEfectivoDe(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string
): Promise<EstadoEfectivo | null> {
  const { data } = await supabase
    .from("vista_proformas")
    .select("estado_efectivo")
    .eq("id", id)
    .maybeSingle()
  return (data?.estado_efectivo as EstadoEfectivo | undefined) ?? null
}

export async function updateProforma(id: string, values: ProformaInput) {
  const parsed = proformaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la proforma." }
  }
  const v = parsed.data

  const supabase = await createClient()

  // No se puede editar una proforma ya convertida ni vencida (Q29).
  const estado = await estadoEfectivoDe(supabase, id)
  if (estado === "convertida") return { error: "La proforma ya fue convertida; no se puede editar." }
  if (estado === "vencida") return { error: "La proforma está vencida (más de 3 meses); es de solo lectura." }
  if (estado === null) return { error: "La proforma no existe." }

  const totales = calcularTotales(v.items, v.descuento_tipo, v.descuento_valor, v.impuesto_porcentaje)

  // R15: PRIMERO se reemplazan los ítems y RECIÉN AL FINAL se actualiza la cabecera
  // (totales + revalidada_en). Así, si el insert de ítems falla, la proforma NO
  // queda con el total viejo y "revalidada"/convertible: la cabecera no se tocó y
  // sigue mostrándose como pendiente (no convertible). El fix atómico es una RPC.
  const { error: delError } = await supabase.from("proforma_items").delete().eq("proforma_id", id)
  if (delError) {
    logError("proformas.updateProforma.delete", delError, { id })
    return { error: "No se pudieron actualizar los ítems de la proforma." }
  }

  const { error: itemsError } = await supabase.from("proforma_items").insert(
    v.items.map((item) => ({
      proforma_id: id,
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
    logError("proformas.updateProforma.items", itemsError, { id })
    return { error: "No se pudieron guardar los ítems de la proforma." }
  }

  // Con los ítems ya guardados, se actualiza la cabecera y se revalida (Q22/Q23):
  // vuelve a estar vigente por su plazo desde ahora.
  const { error: updError } = await supabase
    .from("proformas")
    .update({
      tipo_pago: v.tipo_pago || null,
      tiempo_entrega_dias: v.tiempo_entrega_dias > 0 ? v.tiempo_entrega_dias : null,
      glosa: v.glosa || null,
      subtotal: totales.subtotal,
      descuento_tipo: normalizarDescuento(v.descuento_tipo),
      descuento_valor: v.descuento_valor,
      impuesto_porcentaje: v.impuesto_porcentaje,
      total: totales.total,
      revalidada_en: new Date().toISOString(),
    })
    .eq("id", id)

  if (updError) {
    logError("proformas.updateProforma", updError, { id })
    return { error: "No se pudo actualizar la proforma." }
  }

  revalidatePath("/proformas")
  revalidatePath(`/proformas/${id}`)
  return { ok: true }
}

// Revalida sin cambiar nada (confirma que los precios siguen bien): reinicia el
// plazo desde ahora. No permitido en convertida ni vencida.
export async function revalidarProforma(id: string) {
  const supabase = await createClient()

  const estado = await estadoEfectivoDe(supabase, id)
  if (estado === "convertida") return { error: "La proforma ya fue convertida." }
  if (estado === "vencida") return { error: "La proforma está vencida (más de 3 meses); es de solo lectura." }
  if (estado === null) return { error: "La proforma no existe." }

  const { error } = await supabase
    .from("proformas")
    .update({ revalidada_en: new Date().toISOString() })
    .eq("id", id)

  if (error) {
    logError("proformas.revalidarProforma", error, { id })
    return { error: "No se pudo revalidar la proforma." }
  }

  revalidatePath("/proformas")
  revalidatePath(`/proformas/${id}`)
  return { ok: true }
}

export async function convertirProformaAVenta(proformaId: string) {
  const supabase = await createClient()

  const { data: ventaId, error } = await supabase.rpc("fn_convertir_proforma_a_venta", {
    p_proforma_id: proformaId,
  })
  if (error) {
    logError("proformas.convertirProformaAVenta", error, { proformaId })
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
