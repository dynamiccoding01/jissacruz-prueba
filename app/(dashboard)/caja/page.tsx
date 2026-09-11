import { redirect } from "next/navigation"

import { getPerfil } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { CajaExplorer, type PendienteFila } from "./caja-explorer"

// PLAN_5 · T5: CAJA lista los pedidos pendientes (creados por los vendedores) y el
// cajero los confirma/cobra o cancela. Solo cajero y admin.
export default async function CajaPage() {
  const perfil = await getPerfil()
  if (!perfil || (perfil.rol !== "admin" && perfil.rol !== "cajero")) {
    redirect("/proformas")
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from("ventas_pendientes")
    .select(
      "id, numero, creado_en, total, clientes(id, nombre), creador:perfiles!ventas_pendientes_creado_por_fkey(nombre_completo), venta_pendiente_items(cantidad, precio_unitario, subtotal_linea, productos(codigo, descripcion))"
    )
    .eq("estado", "pendiente")
    .order("creado_en", { ascending: true })

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Caja — pedidos por cobrar</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Confirmá el cobro (elegís tipo de pago y con/sin factura) o cancelá el pedido. Al confirmar
        se descuenta el stock y se genera la factura.
      </p>
      <CajaExplorer pendientes={(data ?? []) as unknown as PendienteFila[]} />
    </div>
  )
}
