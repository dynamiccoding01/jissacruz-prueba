import { redirect } from "next/navigation"

import { getPerfil } from "@/lib/auth/session"
import { Pos } from "./pos"

// El historial de ventas se movió a Reportes (T3): esta pantalla es solo el POS.
// T12: el POS es solo para cajero y admin (el vendedor ya no cobra ventas).
export default async function VentasPage() {
  const perfil = await getPerfil()
  if (!perfil || (perfil.rol !== "admin" && perfil.rol !== "cajero")) {
    redirect("/proformas")
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Punto de venta</h1>
      <Pos />
    </div>
  )
}
