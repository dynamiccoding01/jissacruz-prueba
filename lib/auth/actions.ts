"use server"

import { createClient } from "@/lib/supabase/server"
import { rutaInicio } from "@/lib/auth/session"
import { redirect } from "next/navigation"

export async function signIn(email: string, password: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." }
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("activo, rol")
    .eq("id", data.user.id)
    .single()

  if (!perfil?.activo) {
    await supabase.auth.signOut()
    return { error: "Tu usuario esta desactivado. Contacta al administrador." }
  }

  // Cada rol entra a su pantalla (admin → Dashboard, cajero → Caja, vendedor → Proformas).
  redirect(rutaInicio(perfil.rol))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
