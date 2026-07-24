"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { TAG_SUCURSALES } from "@/lib/datos-cacheados"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { requireAdmin } from "@/lib/auth/session"
import { sucursalSchema, type SucursalValues } from "@/lib/validations/sucursal"

export async function createSucursal(values: SucursalValues) {
  await requireAdmin()
  const parsed = sucursalSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la sucursal." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("sucursales").insert(parsed.data)
  if (error) {
    logError("sucursales.createSucursal", error)
    return {
      error:
        error.code === "23505"
          ? "Ya existe una sucursal con ese código."
          : "No se pudo crear la sucursal.",
    }
  }

  revalidateTag(TAG_SUCURSALES)
  revalidatePath("/sucursales")
  return { success: true }
}

export async function updateSucursal(id: string, values: SucursalValues) {
  await requireAdmin()
  const parsed = sucursalSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la sucursal." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("sucursales").update(parsed.data).eq("id", id)
  if (error) {
    logError("sucursales.updateSucursal", error, { id })
    return {
      error:
        error.code === "23505"
          ? "Ya existe una sucursal con ese código."
          : "No se pudo actualizar la sucursal.",
    }
  }

  revalidateTag(TAG_SUCURSALES)
  revalidatePath("/sucursales")
  return { success: true }
}

export async function deleteSucursal(id: string) {
  await requireAdmin()
  // Borrado logico (activo = false): la sucursal queda referenciada por el
  // historico (kardex, ventas), asi que nunca se borra fisicamente.
  const supabase = await createClient()
  const { error } = await supabase.from("sucursales").update({ activo: false }).eq("id", id)
  if (error) {
    logError("sucursales.deleteSucursal", error, { id })
    return { error: "No se pudo eliminar la sucursal." }
  }
  revalidateTag(TAG_SUCURSALES)
  revalidatePath("/sucursales")
  return { success: true }
}
