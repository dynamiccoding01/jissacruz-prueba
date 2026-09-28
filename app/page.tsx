import { redirect } from "next/navigation"

import { getPerfil, rutaInicio } from "@/lib/auth/session"

export default async function Home() {
  const perfil = await getPerfil()

  // Cada rol entra a su pantalla de inicio; sin sesión, al login.
  redirect(perfil ? rutaInicio(perfil.rol) : "/login")
}
