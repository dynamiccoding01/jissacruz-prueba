"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { productoSchema, type ProductoFormInput } from "@/lib/validations/producto"

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
  const { codigos_equivalentes, vehiculos_compatibles, precios_mayor, ...producto } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_guardar_producto", {
    p_id: id,
    p_producto: producto,
    p_equivalentes: codigos_equivalentes,
    p_vehiculos: vehiculos_compatibles,
    p_precios_mayor: precios_mayor,
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
    .select("codigo_equivalente, fabricante")
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

  return {
    producto,
    codigos: codigos ?? [],
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
