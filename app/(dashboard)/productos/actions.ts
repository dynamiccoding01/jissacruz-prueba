"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { productoSchema, type ProductoFormInput } from "@/lib/validations/producto"
import { ultimoCostoDeProducto } from "@/lib/costos-server"

const bs = (n: number) =>
  `Bs ${Number(n).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// R8/Q4 · Crear y editar producto pasan por la RPC transaccional
// fn_guardar_producto (script 29): cabecera + reemplazo de hijos (equivalentes,
// vehículos, precios por mayor) en UNA sola transacción. Si algo falla, Postgres
// revierte todo — nunca queda un producto sin sus hijos (antes eran varios
// INSERT/DELETE por HTTP sin transacción; ese era el riesgo R8).
async function guardarProducto(
  id: string | null,
  values: ProductoFormInput
): Promise<{ id?: string; error?: string }> {
  const parsed = productoSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del formulario." }
  }
  const {
    codigos_equivalentes,
    codigos_originales,
    vehiculos_compatibles,
    precios_mayor,
    medidas,
    ...producto
  } = parsed.data

  const supabase = await createClient()

  // El precio de VENTA tiene que superar el último costo de compra del producto.
  // Se valida en el servidor (no solo en el formulario) porque es una regla de
  // negocio: sin ella se venden productos por debajo de lo que costaron y nada
  // avisa. Solo aplica al editar: un producto nuevo todavía no tiene compras.
  if (id) {
    const ultimoCosto = await ultimoCostoDeProducto(supabase, id)
    if (ultimoCosto !== null && producto.precio <= ultimoCosto) {
      return {
        error: `El precio de venta (${bs(producto.precio)}) debe ser mayor al último costo de compra (${bs(ultimoCosto)}).`,
      }
    }
  }

  const { data, error } = await supabase.rpc("fn_guardar_producto", {
    p_id: id,
    p_producto: producto,
    p_equivalentes: codigos_equivalentes,
    p_originales: codigos_originales,
    p_vehiculos: vehiculos_compatibles,
    p_precios_mayor: precios_mayor,
    p_medidas: medidas,
  })

  if (error) {
    logError(id ? "productos.updateProducto" : "productos.createProducto", error, { id })
    // 23505 = violación de único (el código de producto ya existe)
    return {
      error:
        error.code === "23505"
          ? "Ya existe un producto con ese código."
          : id
            ? "No se pudo actualizar el producto."
            : "No se pudo crear el producto.",
    }
  }

  revalidatePath("/productos")
  return { id: data as string }
}

export async function createProducto(values: ProductoFormInput) {
  return guardarProducto(null, values)
}

export async function updateProducto(id: string, values: ProductoFormInput) {
  return guardarProducto(id, values)
}

export async function deleteProducto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("productos").update({ activo: false }).eq("id", id)
  if (error) {
    logError("productos.deleteProducto", error, { id })
    return { error: "No se pudo eliminar el producto." }
  }
  revalidatePath("/productos")
  return { success: true }
}

export async function getProductoConDetalle(id: string) {
  const supabase = await createClient()

  const { data: producto } = await supabase.from("productos").select("*").eq("id", id).single()
  const { data: codigos } = await supabase
    .from("producto_codigos_equivalentes")
    .select("codigo_equivalente")
    .eq("producto_id", id)
  const { data: originales } = await supabase
    .from("producto_codigos_originales")
    .select("codigo_original")
    .eq("producto_id", id)
  const { data: vehiculosCompat } = await supabase
    .from("producto_vehiculos_compatibles")
    .select("anio_desde, anio_hasta, vehiculos(marca, modelo)")
    .eq("producto_id", id)
  const { data: preciosMayor } = await supabase
    .from("producto_precios_mayor")
    .select("cantidad_minima, precio, vigente_hasta")
    .eq("producto_id", id)
    .order("cantidad_minima")
  const { data: medidas } = await supabase
    .from("producto_medidas")
    .select("etiqueta, valor, unidad")
    .eq("producto_id", id)
    .order("orden")

  // Referencia para el formulario: el precio de venta debe superar este costo.
  const ultimoCosto = await ultimoCostoDeProducto(supabase, id)

  return {
    producto,
    ultimoCosto,
    codigos: codigos ?? [],
    originales: originales ?? [],
    medidas: (medidas ?? []).map((m) => ({
      etiqueta: m.etiqueta,
      valor: Number(m.valor),
      unidad: m.unidad as "MM" | "CM" | "PULG",
    })),
    precios_mayor: (preciosMayor ?? []).map((p) => ({
      cantidad_minima: p.cantidad_minima,
      precio: Number(p.precio),
      vigente_hasta: p.vigente_hasta ?? "",
    })),
    vehiculos: (vehiculosCompat ?? []).map((v) => ({
      marca: (v.vehiculos as unknown as { marca: string; modelo: string })?.marca ?? "",
      modelo: (v.vehiculos as unknown as { marca: string; modelo: string })?.modelo ?? "",
      anio_desde: v.anio_desde,
      anio_hasta: v.anio_hasta,
    })),
  }
}

export async function searchProductos(query: string, campos: string[] = []) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) {
    logError("productos.searchProductos", error, { query, campos })
    return []
  }
  return data ?? []
}
