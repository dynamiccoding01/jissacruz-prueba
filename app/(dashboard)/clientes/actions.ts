"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { clienteSchema, type ClienteValues } from "@/lib/validations/cliente"

const CAMPOS = "id, nombre, ci_nit, telefono, direccion"

export async function createCliente(values: ClienteValues) {
  const parsed = clienteSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del cliente." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("clientes").insert(parsed.data)
  if (error) {
    return { error: "No se pudo crear el cliente." }
  }

  revalidatePath("/clientes")
  return { success: true }
}

export async function updateCliente(id: string, values: ClienteValues) {
  const parsed = clienteSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del cliente." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("clientes").update(parsed.data).eq("id", id)
  if (error) {
    return { error: "No se pudo actualizar el cliente." }
  }

  revalidatePath("/clientes")
  return { success: true }
}

export async function deleteCliente(id: string) {
  const supabase = await createClient()
  // La tabla clientes no tiene columna `activo`: el borrado es fisico.
  // Si el cliente ya tiene proformas/ventas, el FK lo impide (error 23503).
  const { error } = await supabase.from("clientes").delete().eq("id", id)
  if (error) {
    if (error.code === "23503") {
      return {
        error: "No se puede eliminar: el cliente tiene proformas o ventas registradas.",
      }
    }
    return { error: "No se pudo eliminar el cliente." }
  }

  revalidatePath("/clientes")
  return { success: true }
}

export async function searchClientes(query: string) {
  const supabase = await createClient()
  // Sanea el termino: quita los caracteres que rompen la sintaxis de PostgREST .or()
  const term = query.trim().replace(/[,()*%\\]/g, " ").trim()

  let consulta = supabase.from("clientes").select(CAMPOS).order("nombre").limit(50)
  if (term) {
    consulta = consulta.or(
      `nombre.ilike.%${term}%,ci_nit.ilike.%${term}%,telefono.ilike.%${term}%`
    )
  }

  const { data } = await consulta
  return data ?? []
}
