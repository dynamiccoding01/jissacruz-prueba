import "server-only"
import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export type SucursalMinima = { id: string; codigo: string; nombre: string }

export type Perfil = {
  id: string
  nombre_completo: string
  rol: "admin" | "vendedor" | "cajero"
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
    rol: p.rol as "admin" | "vendedor" | "cajero",
    activo: p.activo as boolean,
    sucursal_id: (p.sucursal_id as string | null) ?? null,
    sucursal: (p.sucursales as SucursalMinima | null) ?? null,
  }
})

type Rol = Perfil["rol"]

// Pantalla de inicio de cada rol: a donde va al iniciar sesión y a donde se lo
// manda si intenta abrir una página que no le corresponde. El cajero trabaja en
// Caja (antes caía en Proformas, que no es de su rol).
export function rutaInicio(rol: Rol | null | undefined): string {
  if (rol === "admin") return "/dashboard"
  if (rol === "cajero") return "/caja"
  return "/proformas"
}

// Guarda de página/acción por rol (el layout ya valida sesión/activo; esto evita
// que alguien entre escribiendo la URL de un módulo que no es de su rol).
export async function requireRol(roles: Rol[]): Promise<Perfil> {
  const perfil = await getPerfil()
  if (!perfil) redirect("/login")
  if (!roles.includes(perfil.rol)) redirect(rutaInicio(perfil.rol))
  return perfil
}

// Guarda para páginas exclusivas de admin.
export async function requireAdmin(): Promise<Perfil> {
  return requireRol(["admin"])
}
