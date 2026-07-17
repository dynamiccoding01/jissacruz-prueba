import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type SucursalMinima = { id: string; codigo: string; nombre: string }

export type Perfil = {
  id: string
  nombre_completo: string
  rol: "admin" | "vendedor"
  activo: boolean
  sucursal_id: string | null
  sucursal: SucursalMinima | null
}

// cache(): dedupea la consulta si el layout y una page la piden en el mismo request
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, rol, activo, sucursal_id, sucursales(id, codigo, nombre)")
    .eq("id", user.id)
    .single()

  if (!perfil) return null

  const p = perfil as Record<string, unknown>
  return {
    id: p.id as string,
    nombre_completo: p.nombre_completo as string,
    rol: p.rol as "admin" | "vendedor",
    activo: p.activo as boolean,
    sucursal_id: (p.sucursal_id as string | null) ?? null,
    sucursal: (p.sucursales as SucursalMinima | null) ?? null,
  }
})

// Guarda para paginas exclusivas de admin (el layout ya valida sesion/activo;
// esto evita que un vendedor entre escribiendo la URL directamente).
export async function requireAdmin(): Promise<Perfil> {
  const perfil = await getPerfil()
  if (!perfil || perfil.rol !== "admin") {
    redirect("/proformas")
  }
  return perfil
}
