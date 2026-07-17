"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
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
    return {
      error:
        error.code === "23505"
          ? "Ya existe una sucursal con ese código."
          : "No se pudo crear la sucursal.",
    }
  }

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
    return {
      error:
        error.code === "23505"
          ? "Ya existe una sucursal con ese código."
          : "No se pudo actualizar la sucursal.",
    }
  }

  revalidatePath("/sucursales")
  return { success: true }
}

export async function deleteSucursal(id: string) {
  await requireAdmin()
  // Borrado logico (activo = false): la sucursal queda referenciada por el
  // historico (kardex, ventas), asi que nunca se borra fisicamente.
  const supabase = await createClient()
  const { error } = await supabase.from("sucursales").update({ activo: false }).eq("id", id)
  if (error) return { error: "No se pudo eliminar la sucursal." }
  revalidatePath("/sucursales")
  return { success: true }
}
