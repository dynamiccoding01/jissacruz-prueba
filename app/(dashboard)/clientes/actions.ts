"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { clienteSchema, type ClienteValues } from "@/lib/validations/cliente"

const CAMPOS = "id, nombre, ci_nit, complemento, nombre_factura, telefono, direccion"

export type ClienteBusqueda = {
  id: string
  nombre: string
  ci_nit: string | null
  complemento: string | null
  nombre_factura: string | null
  telefono: string | null
  direccion: string | null
}

export async function createCliente(values: ClienteValues) {
  const parsed = clienteSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del cliente." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("clientes").insert(parsed.data)
  if (error) {
    logError("clientes.createCliente", error)
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
    logError("clientes.updateCliente", error, { id })
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
    logError("clientes.deleteCliente", error, { id })
    return { error: "No se pudo eliminar el cliente." }
  }

  revalidatePath("/clientes")
  return { success: true }
}

export type HistorialProforma = {
  id: string
  numero: string
  creado_en: string
  total: number
  estado: "vigente" | "convertida" | "vencida"
}

export type HistorialVenta = {
  id: string
  numero: string
  creado_en: string
  total: number
}

export async function getHistorialCliente(clienteId: string) {
  const supabase = await createClient()

  const [{ data: proformas }, { data: ventas }] = await Promise.all([
    supabase
      .from("proformas")
      .select("id, numero, creado_en, total, estado")
      .eq("cliente_id", clienteId)
      .order("creado_en", { ascending: false }),
    supabase
      .from("ventas")
      .select("id, numero, creado_en, total")
      .eq("cliente_id", clienteId)
      .order("creado_en", { ascending: false }),
  ])

  return {
    proformas: (proformas ?? []) as HistorialProforma[],
    ventas: (ventas ?? []) as HistorialVenta[],
  }
}

export async function searchClientes(query: string): Promise<ClienteBusqueda[]> {
  const supabase = await createClient()
  // Sanea el termino: quita los caracteres que rompen la sintaxis de PostgREST .or()
  const term = query.trim().replace(/[,()*%\\]/g, " ").trim()

  let consulta = supabase.from("clientes").select(CAMPOS).order("nombre").limit(50)
  if (term) {
    consulta = consulta.or(
      `nombre.ilike.%${term}%,ci_nit.ilike.%${term}%,nombre_factura.ilike.%${term}%,telefono.ilike.%${term}%`
    )
  }

  const { data } = await consulta
  return (data ?? []) as ClienteBusqueda[]
}
