"use server"

import { revalidatePath, revalidateTag } from "next/cache"

import { TAG_CONFIG_EMPRESA } from "@/lib/datos-cacheados"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { logError } from "@/lib/log"
import { requireAdmin } from "@/lib/auth/session"
import {
  empresaSchema,
  nuevoUsuarioSchema,
  type EmpresaValues,
  type NuevoUsuarioValues,
} from "@/lib/validations/configuracion"

export async function updateEmpresa(values: EmpresaValues) {
  await requireAdmin()
  const parsed = empresaSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la empresa." }
  }
  const v = parsed.data

  const supabase = await createClient()
  const { error } = await supabase
    .from("configuracion_empresa")
    .update({
      nombre: v.nombre,
      nit: v.nit || null,
      direccion: v.direccion || null,
      telefono: v.telefono || null,
      stock_minimo_default: v.stock_minimo_default,
    })
    .eq("id", 1)

  if (error) {
    logError("configuracion.updateEmpresa", error)
    return { error: "No se pudo guardar la configuración de la empresa." }
  }

  revalidateTag(TAG_CONFIG_EMPRESA)
  revalidatePath("/configuracion")
  return { success: true }
}

export async function crearUsuario(values: NuevoUsuarioValues) {
  // Valida que quien llama sea admin ANTES de usar el cliente service_role.
  await requireAdmin()
  const parsed = nuevoUsuarioSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del usuario." }
  }
  const v = parsed.data

  // service_role: crea el usuario en Auth. El trigger on_auth_user_created
  // (script 02) inserta automáticamente la fila en `perfiles` con el rol.
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    // El trigger on_auth_user_created (script 13) lee sucursal_id de acá.
    user_metadata: { nombre_completo: v.nombre_completo, rol: v.rol, sucursal_id: v.sucursal_id },
  })

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return { error: "Ya existe un usuario con ese correo." }
    }
    logError("configuracion.crearUsuario", error, { email: v.email })
    return { error: error.message || "No se pudo crear el usuario." }
  }

  revalidatePath("/configuracion")
  return { success: true }
}

export async function asignarSucursal(id: string, sucursalId: string) {
  await requireAdmin()
  const supabase = await createClient()
  const { error } = await supabase.from("perfiles").update({ sucursal_id: sucursalId }).eq("id", id)
  if (error) {
    logError("configuracion.asignarSucursal", error, { id, sucursalId })
    return { error: "No se pudo asignar la sucursal." }
  }
  revalidatePath("/configuracion")
  return { success: true }
}

export async function toggleUsuarioActivo(id: string, activo: boolean) {
  const perfil = await requireAdmin()
  // Evita que un admin se bloquee a sí mismo dejándose sin acceso.
  if (id === perfil.id && !activo) {
    return { error: "No podés desactivar tu propia cuenta." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("perfiles").update({ activo }).eq("id", id)

  if (error) {
    logError("configuracion.toggleUsuarioActivo", error, { id, activo })
    return { error: "No se pudo actualizar el estado del usuario." }
  }

  revalidatePath("/configuracion")
  return { success: true }
}
