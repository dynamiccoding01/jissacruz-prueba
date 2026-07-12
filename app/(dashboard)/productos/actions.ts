"use server"

import { revalidatePath } from "next/cache"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { productoSchema, type ProductoFormInput, type ProductoFormValues } from "@/lib/validations/producto"

async function guardarHijos(
  supabase: SupabaseClient,
  productoId: string,
  codigos: ProductoFormValues["codigos_equivalentes"],
  vehiculos: ProductoFormValues["vehiculos_compatibles"]
) {
  if (codigos.length > 0) {
    const { error } = await supabase.from("producto_codigos_equivalentes").insert(
      codigos.map((c) => ({
        producto_id: productoId,
        codigo_equivalente: c.codigo_equivalente,
        fabricante: c.fabricante || null,
      }))
    )
    if (error) throw new Error("No se pudieron guardar los códigos equivalentes.")
  }

  for (const v of vehiculos) {
    const { data: vehiculo, error: vehiculoError } = await supabase
      .from("vehiculos")
      .upsert({ marca: v.marca, modelo: v.modelo }, { onConflict: "marca,modelo" })
      .select("id")
      .single()

    if (vehiculoError || !vehiculo) {
      throw new Error("No se pudo guardar el vehículo compatible.")
    }

    const { error: pvcError } = await supabase.from("producto_vehiculos_compatibles").insert({
      producto_id: productoId,
      vehiculo_id: vehiculo.id,
      anio_desde: v.anio_desde || null,
      anio_hasta: v.anio_hasta || null,
    })
    if (pvcError) throw new Error("No se pudo guardar la compatibilidad de vehículo.")
  }
}

export async function createProducto(values: ProductoFormInput) {
  const parsed = productoSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del formulario." }
  }
  const { codigos_equivalentes, vehiculos_compatibles, ...producto } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: nuevoProducto, error } = await supabase
    .from("productos")
    .insert({ ...producto, creado_por: user?.id })
    .select("id")
    .single()

  if (error || !nuevoProducto) {
    return {
      error:
        error?.code === "23505"
          ? "Ya existe un producto con ese código."
          : "No se pudo crear el producto.",
    }
  }

  try {
    await guardarHijos(supabase, nuevoProducto.id, codigos_equivalentes, vehiculos_compatibles)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo completar el producto." }
  }

  revalidatePath("/productos")
  return { id: nuevoProducto.id }
}

export async function updateProducto(id: string, values: ProductoFormInput) {
  const parsed = productoSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del formulario." }
  }
  const { codigos_equivalentes, vehiculos_compatibles, ...producto } = parsed.data

  const supabase = await createClient()

  const { error } = await supabase.from("productos").update(producto).eq("id", id)
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ya existe un producto con ese código."
          : "No se pudo actualizar el producto.",
    }
  }

  // reemplaza los hijos por el set actual del formulario (listas chicas, mas simple que diffear)
  await supabase.from("producto_codigos_equivalentes").delete().eq("producto_id", id)
  await supabase.from("producto_vehiculos_compatibles").delete().eq("producto_id", id)

  try {
    await guardarHijos(supabase, id, codigos_equivalentes, vehiculos_compatibles)
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo completar el producto." }
  }

  revalidatePath("/productos")
  return { id }
}

export async function deleteProducto(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("productos").update({ activo: false }).eq("id", id)
  if (error) return { error: "No se pudo eliminar el producto." }
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

  return {
    producto,
    codigos: codigos ?? [],
    vehiculos: (vehiculosCompat ?? []).map((v) => ({
      marca: (v.vehiculos as unknown as { marca: string; modelo: string })?.marca ?? "",
      modelo: (v.vehiculos as unknown as { marca: string; modelo: string })?.modelo ?? "",
      anio_desde: v.anio_desde,
      anio_hasta: v.anio_hasta,
    })),
  }
}

export async function searchProductos(query: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", { p_query: query })
  if (error) return []
  return data ?? []
}
