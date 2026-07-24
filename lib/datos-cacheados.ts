import "server-only"

import { unstable_cache } from "next/cache"

import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/log"

// Datos casi estaticos cacheados entre requests con unstable_cache.
// Se usa el cliente admin (service_role) porque unstable_cache no permite
// leer cookies dentro de la funcion cacheada; son datos no sensibles que
// toda sesion autenticada puede ver, y las paginas que los consumen ya
// validan sesion antes. Invalidar con revalidateTag(...) en las actions
// que los modifican.

export type ConfiguracionEmpresa = {
  nombre: string
  nit: string | null
  direccion: string | null
  telefono: string | null
  logo_url: string | null
  stock_minimo_default: number
}

export const TAG_CONFIG_EMPRESA = "configuracion-empresa"
export const TAG_SUCURSALES = "sucursales"

export const getConfiguracionEmpresa = unstable_cache(
  async (): Promise<ConfiguracionEmpresa | null> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("configuracion_empresa")
      .select("nombre, nit, direccion, telefono, logo_url, stock_minimo_default")
      .eq("id", 1)
      .single()
    if (error) {
      logError("datos-cacheados.getConfiguracionEmpresa", error)
      return null
    }
    return data
  },
  ["configuracion-empresa"],
  { tags: [TAG_CONFIG_EMPRESA], revalidate: 3600 }
)

export type Sucursal = {
  id: string
  codigo: string
  nombre: string
  direccion: string | null
  telefono: string | null
}

export const getSucursalesActivas = unstable_cache(
  async (): Promise<Sucursal[]> => {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from("sucursales")
      .select("id, codigo, nombre, direccion, telefono")
      .eq("activo", true)
      .order("codigo")
    if (error) {
      logError("datos-cacheados.getSucursalesActivas", error)
      return []
    }
    return data ?? []
  },
  ["sucursales-activas"],
  { tags: [TAG_SUCURSALES], revalidate: 3600 }
)
