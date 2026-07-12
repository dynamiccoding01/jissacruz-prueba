import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { EmpresaForm } from "./empresa-form"
import { UsuariosPanel, type UsuarioFila } from "./usuarios-panel"

export default async function ConfiguracionPage() {
  const perfil = await requireAdmin()
  const supabase = await createClient()

  const [{ data: empresa }, { data: usuarios }] = await Promise.all([
    supabase
      .from("configuracion_empresa")
      .select("nombre, nit, direccion, telefono, stock_minimo_default")
      .eq("id", 1)
      .single(),
    supabase
      .from("perfiles")
      .select("id, nombre_completo, rol, activo, creado_en")
      .order("creado_en"),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Configuración</h1>

      <EmpresaForm
        empresa={
          empresa
            ? {
                nombre: empresa.nombre,
                nit: empresa.nit ?? "",
                direccion: empresa.direccion ?? "",
                telefono: empresa.telefono ?? "",
                stock_minimo_default: empresa.stock_minimo_default ?? 0,
              }
            : { nombre: "JISSACRUZ", nit: "", direccion: "", telefono: "", stock_minimo_default: 0 }
        }
      />

      <UsuariosPanel
        usuarios={(usuarios ?? []) as UsuarioFila[]}
        currentUserId={perfil.id}
      />
    </div>
  )
}
