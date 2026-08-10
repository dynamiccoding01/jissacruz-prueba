"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { logError } from "@/lib/log"
import type { EscalaPrecio } from "@/lib/precios-mayor"
import { escalasVigentesPorProducto } from "@/lib/precios-mayor-server"
import { datosBusquedaPorProducto } from "@/lib/producto-busqueda-server"
import type { Medida } from "@/lib/medidas"
import { ventaSchema, normalizarDescuento, type VentaInput } from "@/lib/validations/venta"

// Desglose de stock por sucursal, compatible con <StockBadge /> (que solo lee
// stock_actual + sucursales.codigo/nombre). Se agrega el id para poder ubicar
// la sucursal desde la que opera el POS.
export type StockSucursal = {
  stock_actual: number
  sucursales: { id: string; codigo: string; nombre: string } | null
}

export type ProductoBusqueda = {
  id: string
  codigo: string
  descripcion: string
  precio: number
  // C3: escalas de precio por mayor VIGENTES (filtradas por fecha en el
  // servidor), ordenadas por cantidad_minima ascendente.
  escalas: EscalaPrecio[]
  // Stock TOTAL (suma de sucursales) y mínimo, para el badge de color.
  stockTotal: number
  stockMinimo: number
  // Stock en la sucursal del usuario que opera el POS: la venta descuenta solo
  // de esta sucursal (fn_registrar_venta usa fn_mi_sucursal), así que es lo que
  // limita cuánto se puede agregar al carrito.
  stockSucursalActual: number
  // Desglose por sucursal para mostrar (todas las sucursales), como en Productos.
  porSucursal: StockSucursal[]
  // Sprint 6: unidad de venta, medidas y códigos originales (OEM) para mostrar.
  unidad: string
  medidas: Medida[]
  originales: string[]
  // T6: si el producto se maneja sin factura (para el badge S/F y sugerir el
  // "Sin factura" al cobrar).
  con_factura: boolean
}

export async function buscarProductosParaVenta(
  query: string,
  campos: string[] = []
): Promise<ProductoBusqueda[]> {
  const supabase = await createClient()
  const perfil = await getPerfil()
  const sucursalActualId = perfil?.sucursal_id ?? null

  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) {
    logError("ventas.buscarProductosParaVenta", error, { query, campos })
    return []
  }

  const filas = (data ?? []) as {
    id: string
    codigo: string
    descripcion: string
    precio: number
    stock_actual: number
    stock_minimo: number
    unidad_medida: string
    con_factura: boolean
  }[]
  const ids = filas.map((p) => p.id)

  const [escalas, datos, stockRes] = await Promise.all([
    escalasVigentesPorProducto(supabase, ids),
    datosBusquedaPorProducto(supabase, ids),
    ids.length
      ? supabase
          .from("producto_stock_sucursal")
          .select("producto_id, stock_actual, sucursales(id, codigo, nombre)")
          .in("producto_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (stockRes.error) {
    logError("ventas.buscarProductosParaVenta.stock", stockRes.error, { ids: ids.length })
  }

  // producto_id -> desglose por sucursal
  const porProducto = new Map<string, StockSucursal[]>()
  for (const r of (stockRes.data ?? []) as unknown as Array<{
    producto_id: string
    stock_actual: number
    sucursales: { id: string; codigo: string; nombre: string } | null
  }>) {
    const arr = porProducto.get(r.producto_id) ?? []
    arr.push({ stock_actual: r.stock_actual, sucursales: r.sucursales })
    porProducto.set(r.producto_id, arr)
  }

  return filas.map((p) => {
    const porSucursal = (porProducto.get(p.id) ?? [])
      .slice()
      .sort((a, b) => (a.sucursales?.codigo ?? "").localeCompare(b.sucursales?.codigo ?? ""))
    const stockSucursalActual = sucursalActualId
      ? porSucursal.find((s) => s.sucursales?.id === sucursalActualId)?.stock_actual ?? 0
      : Number(p.stock_actual) // sin sucursal asignada: cae al total
    return {
      id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      precio: Number(p.precio),
      escalas: escalas.get(p.id) ?? [],
      stockTotal: Number(p.stock_actual),
      stockMinimo: Number(p.stock_minimo),
      stockSucursalActual,
      porSucursal,
      unidad: p.unidad_medida,
      medidas: datos.get(p.id)?.medidas ?? [],
      originales: datos.get(p.id)?.originales ?? [],
      con_factura: p.con_factura ?? true,
    }
  })
}

export async function registrarVenta(values: VentaInput) {
  // T12: solo cajero y admin pueden cerrar/cobrar ventas.
  const perfil = await getPerfil()
  if (!perfil || (perfil.rol !== "admin" && perfil.rol !== "cajero")) {
    return { error: "Solo un cajero o un administrador puede registrar ventas." }
  }

  const parsed = ventaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la venta." }
  }
  const v = parsed.data

  const supabase = await createClient()

  const payload = {
    cliente_id: v.cliente_id || null,
    proforma_origen_id: null,
    tipo_pago: v.tipo_pago || null,
    con_factura: v.con_factura,
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
    logError("ventas.registrarVenta", error, { cliente_id: v.cliente_id, items: v.items.length })
    return { error: error.message || "No se pudo registrar la venta." }
  }

  const { data: venta } = await supabase.from("ventas").select("numero").eq("id", ventaId).single()

  revalidatePath("/ventas")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  revalidatePath("/productos")
  return { id: ventaId as string, numero: venta?.numero as string | undefined }
}
