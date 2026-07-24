"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"

export type TraspasoItemInput = {
  producto_id: string
  cantidad: number
}

export async function crearPedidoTraspaso(
  sucursalDestinoId: string,
  items: TraspasoItemInput[],
  notas?: string,
  sucursalOrigenId?: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_crear_pedido_traspaso", {
    p_sucursal_destino_id: sucursalDestinoId,
    p_items: items,
    p_notas: notas || null,
    p_sucursal_origen_id: sucursalOrigenId || null,
  })

  if (error) {
    logError("traspasos.crearPedidoTraspaso", error, { sucursalDestinoId, items: items.length })
    return { error: error.message || "No se pudo crear el pedido de traspaso." }
  }
  revalidatePath("/traspasos")
  revalidatePath("/inventario")
  return { id: data as string }
}

export async function enviarTraspaso(pedidoId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_enviar_traspaso", { p_pedido_id: pedidoId })
  if (error) {
    logError("traspasos.enviarTraspaso", error, { pedidoId })
    return { error: error.message || "No se pudo despachar el traspaso." }
  }

  revalidatePath("/traspasos")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  return { success: true }
}

export async function recibirTraspaso(pedidoId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_recibir_traspaso", { p_pedido_id: pedidoId })
  if (error) {
    logError("traspasos.recibirTraspaso", error, { pedidoId })
    return { error: error.message || "No se pudo recibir el traspaso." }
  }

  revalidatePath("/traspasos")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  return { success: true }
}

export async function cancelarTraspaso(pedidoId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_cancelar_traspaso", { p_pedido_id: pedidoId })
  if (error) {
    logError("traspasos.cancelarTraspaso", error, { pedidoId })
    return { error: error.message || "No se pudo cancelar el traspaso." }
  }

  revalidatePath("/traspasos")
  return { success: true }
}
