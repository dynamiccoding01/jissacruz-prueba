import { createClient } from "@/lib/supabase/server"
import { requireRol } from "@/lib/auth/session"
import { ProformasExplorer, type ProformaFila } from "./proformas-explorer"

export default async function ProformasPage() {
  // Proformas es de vendedor y admin (el cajero no la tiene en su menú).
  await requireRol(["admin", "vendedor"])
  const supabase = await createClient()

  const [{ data: proformas }, { data: clientes }] = await Promise.all([
    supabase
      .from("proformas")
      .select("id, numero, creado_en, plazo_validez_dias, revalidada_en, total, estado, clientes(id, nombre)")
      .order("creado_en", { ascending: false }),
    supabase.from("clientes").select("id, nombre").order("nombre"),
  ])

  return (
    <ProformasExplorer
      proformas={(proformas ?? []) as unknown as ProformaFila[]}
      clientes={clientes ?? []}
    />
  )
}
