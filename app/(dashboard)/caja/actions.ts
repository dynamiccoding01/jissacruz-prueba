"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { logError } from "@/lib/log"

// PLAN_5 · T5: el cajero (o admin) confirma un pedido pendiente. Recién acá se
// corre fn_registrar_venta (atómica): revalida stock, FIFO, kardex, VEN-xxxx.
export async function confirmarVentaPendiente(
  id: string,
  tipoPago: string,
  conFactura: boolean
) {
  const perfil = await getPerfil()
  if (!perfil || (perfil.rol !== "admin" && perfil.rol !== "cajero")) {
    return { error: "Solo un cajero o un administrador puede confirmar ventas." }
  }

  const supabase = await createClient()
  const { data: ventaId, error } = await supabase.rpc("fn_confirmar_venta_pendiente", {
    p_id: id,
    p_tipo_pago: tipoPago || null,
    p_con_factura: conFactura,
  })
  if (error) {
    logError("caja.confirmarVentaPendiente", error, { id })
    return { error: error.message || "No se pudo confirmar la venta." }
  }

  const { data: venta } = await supabase.from("ventas").select("numero").eq("id", ventaId).single()

  revalidatePath("/caja")
  revalidatePath("/ventas")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  revalidatePath("/productos")
  return { id: ventaId as string, numero: venta?.numero as string | undefined }
}

export async function cancelarVentaPendiente(id: string) {
  const perfil = await getPerfil()
  if (!perfil || (perfil.rol !== "admin" && perfil.rol !== "cajero")) {
    return { error: "Solo un cajero o un administrador puede cancelar pedidos." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_cancelar_venta_pendiente", { p_id: id })
  if (error) {
    logError("caja.cancelarVentaPendiente", error, { id })
    return { error: error.message || "No se pudo cancelar el pedido." }
  }

  revalidatePath("/caja")
  return { ok: true }
}
