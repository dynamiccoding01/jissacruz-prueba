import { createClient } from "@/lib/supabase/server"
import { ProformasExplorer, type ProformaFila } from "./proformas-explorer"

export default async function ProformasPage() {
  const supabase = await createClient()

  const [{ data: proformas }, { data: clientes }] = await Promise.all([
    supabase
      .from("proformas")
      .select("id, numero, creado_en, plazo_validez_dias, total, estado, clientes(id, nombre)")
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
