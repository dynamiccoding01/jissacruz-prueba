"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { requireAdmin } from "@/lib/auth/session"
import { getUnidadesActivas, TAG_UNIDADES, type UnidadMedida } from "@/lib/datos-cacheados"
import { unidadSchema, type UnidadValues } from "@/lib/validations/unidad"

export async function createUnidad(values: UnidadValues) {
  await requireAdmin()
  const parsed = unidadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la unidad." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("unidades_medida").insert({
    codigo: parsed.data.codigo,
    nombre: parsed.data.nombre,
    abreviatura: parsed.data.abreviatura || null,
  })
  if (error) {
    logError("unidades.createUnidad", error)
    return {
      error:
        error.code === "23505"
          ? "Ya existe una unidad con ese código."
          : "No se pudo crear la unidad.",
    }
  }

  revalidateTag(TAG_UNIDADES)
  revalidatePath("/unidades-medida")
  return { success: true }
}

export async function updateUnidad(id: string, values: UnidadValues) {
  await requireAdmin()
  const parsed = unidadSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la unidad." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("unidades_medida")
    .update({
      codigo: parsed.data.codigo,
      nombre: parsed.data.nombre,
      abreviatura: parsed.data.abreviatura || null,
    })
    .eq("id", id)
  if (error) {
    logError("unidades.updateUnidad", error, { id })
    return {
      error:
        error.code === "23505"
          ? "Ya existe una unidad con ese código."
          : "No se pudo actualizar la unidad.",
    }
  }

  revalidateTag(TAG_UNIDADES)
  revalidatePath("/unidades-medida")
  return { success: true }
}

export async function deleteUnidad(id: string) {
  await requireAdmin()
  // Baja lógica: `on delete restrict` impide borrar una unidad en uso, así que
  // se desactiva (deja de aparecer en los selectores, pero no rompe productos).
  const supabase = await createClient()
  const { error } = await supabase.from("unidades_medida").update({ activo: false }).eq("id", id)
  if (error) {
    logError("unidades.deleteUnidad", error, { id })
    return { error: "No se pudo desactivar la unidad." }
  }
  revalidateTag(TAG_UNIDADES)
  revalidatePath("/unidades-medida")
  return { success: true }
}

// La usa el formulario de producto para poblar el <select> de unidad.
export async function listarUnidadesActivas(): Promise<UnidadMedida[]> {
  return getUnidadesActivas()
}
