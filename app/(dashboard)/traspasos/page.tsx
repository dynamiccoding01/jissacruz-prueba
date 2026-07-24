import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { getSucursalesActivas } from "@/lib/datos-cacheados"
import { TraspasosExplorer, type TraspasoFila } from "./traspasos-explorer"
import type { SucursalOption } from "./traspaso-form"

export default async function TraspasosPage() {
  const perfil = await getPerfil()
  const supabase = await createClient()

  const sucursalData = await getSucursalesActivas()

  const { data: traspasoData } = await supabase
    .from("pedidos_traspaso")
    .select(`
      id, numero, estado, creado_en, fecha_envio, fecha_recepcion, notas,
      sucursal_origen:sucursales!pedidos_traspaso_sucursal_origen_id_fkey(id, codigo, nombre),
      sucursal_destino:sucursales!pedidos_traspaso_sucursal_destino_id_fkey(id, codigo, nombre),
      items:pedido_traspaso_items(
        id, cantidad, costo_fifo_unitario,
        producto:productos(id, codigo, descripcion)
      )
    `)
    .order("creado_en", { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos y Traspasos de Stock</h1>
        <p className="text-sm text-muted-foreground">
          Gestión de transferencias de productos entre sucursales y almacenes.
        </p>
      </div>

      <TraspasosExplorer
        traspasos={(traspasoData ?? []) as unknown as TraspasoFila[]}
        sucursales={(sucursalData ?? []) as SucursalOption[]}
        userSucursalId={perfil?.sucursal_id ?? undefined}
        rol={perfil!.rol}
      />
    </div>
  )
}
