"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { proveedorSchema, type ProveedorValues } from "@/lib/validations/proveedor"

export async function createProveedor(values: ProveedorValues) {
  const parsed = proveedorSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del proveedor." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("proveedores").insert(parsed.data)
  if (error) {
    return { error: "No se pudo crear el proveedor." }
  }

  revalidatePath("/proveedores")
  return { success: true }
}

export async function updateProveedor(id: string, values: ProveedorValues) {
  const parsed = proveedorSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del proveedor." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("proveedores").update(parsed.data).eq("id", id)
  if (error) {
    return { error: "No se pudo actualizar el proveedor." }
  }

  revalidatePath("/proveedores")
  return { success: true }
}

export async function deleteProveedor(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from("proveedores").update({ activo: false }).eq("id", id)
  if (error) return { error: "No se pudo eliminar el proveedor." }
  revalidatePath("/proveedores")
  return { success: true }
}
