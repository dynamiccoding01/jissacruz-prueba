import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { Sidebar } from "@/components/shared/sidebar"
import { Header } from "@/components/shared/header"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const perfil = await getPerfil()

  if (!perfil || !perfil.activo) {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/login")
  }

  return (
    <div className="flex">
      <Sidebar rol={perfil.rol} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header nombre={perfil.nombre_completo} rol={perfil.rol} />
        <main className="flex-1 bg-muted/20 p-6">{children}</main>
      </div>
    </div>
  )
}
