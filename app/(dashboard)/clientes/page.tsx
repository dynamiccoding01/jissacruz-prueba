import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { ClientesExplorer, type ClienteFila } from "./clientes-explorer"

export default async function ClientesPage() {
  const perfil = await getPerfil()
  const supabase = await createClient()

  const { data } = await supabase
    .from("clientes")
    .select("id, nombre, ci_nit, telefono, direccion")
    .order("nombre")

  return (
    <ClientesExplorer clientesIniciales={(data ?? []) as ClienteFila[]} rol={perfil!.rol} />
  )
}
