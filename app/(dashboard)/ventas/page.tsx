import { redirect } from "next/navigation"

import { getPerfil } from "@/lib/auth/session"
import { Pos } from "./pos"

// PLAN_5 · T5: el POS crea PEDIDOS de venta (no cobra). Lo usan el vendedor y el
// admin; el cajero cobra/confirma en CAJA.
export default async function VentasPage() {
  const perfil = await getPerfil()
  if (!perfil || (perfil.rol !== "admin" && perfil.rol !== "vendedor")) {
    redirect("/proformas")
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Punto de venta — nuevo pedido</h1>
      <Pos />
    </div>
  )
}
