"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function signIn(email: string, password: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." }
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("activo")
    .eq("id", data.user.id)
    .single()

  if (!perfil?.activo) {
    await supabase.auth.signOut()
    return { error: "Tu usuario esta desactivado. Contacta al administrador." }
  }

  redirect("/dashboard")
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
