import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { EmpresaForm } from "./empresa-form"
import { UsuariosPanel, type UsuarioFila } from "./usuarios-panel"

export default async function ConfiguracionPage() {
  const perfil = await requireAdmin()
  const supabase = await createClient()

  const [{ data: empresa }, { data: usuarios }, { data: sucursales }] = await Promise.all([
    supabase
      .from("configuracion_empresa")
      .select("nombre, nit, direccion, telefono, stock_minimo_default")
      .eq("id", 1)
      .single(),
    supabase
      .from("perfiles")
      .select("id, nombre_completo, rol, activo, creado_en, sucursal_id, sucursales(id, nombre)")
      .order("creado_en"),
    supabase.from("sucursales").select("id, nombre").eq("activo", true).order("codigo"),
  ])

  const usuariosFila: UsuarioFila[] = (usuarios ?? []).map((u) => {
    const s = (u as Record<string, unknown>).sucursales as { id: string; nombre: string } | null
    return {
      id: u.id as string,
      nombre_completo: u.nombre_completo as string,
      rol: u.rol as UsuarioFila["rol"],
      activo: u.activo as boolean,
      creado_en: u.creado_en as string,
      sucursal_id: s?.id ?? null,
      sucursal_nombre: s?.nombre ?? null,
    }
  })

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
        usuarios={usuariosFila}
        sucursales={sucursales ?? []}
        currentUserId={perfil.id}
      />
    </div>
  )
}
