"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"

export type TraspasoItemInput = {
  producto_id: string
  cantidad: number
}

// Parte III: el pedido lo crea el DESTINO (solicitante) y elige el ORIGEN al que
// le pide. Para un vendedor, destino = su sucursal (la RPC lo deriva); un admin
// puede pasar el destino explícito.
export async function crearPedidoTraspaso(
  sucursalOrigenId: string,
  items: TraspasoItemInput[],
  notas?: string,
  sucursalDestinoId?: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_crear_pedido_traspaso", {
    p_sucursal_origen_id: sucursalOrigenId,
    p_items: items,
    p_notas: notas || null,
    p_sucursal_destino_id: sucursalDestinoId || null,
  })

  if (error) {
    logError("traspasos.crearPedidoTraspaso", error, { sucursalOrigenId, items: items.length })
    return { error: error.message || "No se pudo crear el pedido de traspaso." }
  }
  revalidatePath("/traspasos")
  revalidatePath("/inventario")
  return { id: data as string }
}

// El origen puede recortar cantidades antes de despachar (0 = no manda ese ítem).
export async function enviarTraspaso(pedidoId: string, cantidades?: TraspasoItemInput[]) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_enviar_traspaso", {
    p_pedido_id: pedidoId,
    p_items: cantidades && cantidades.length > 0 ? cantidades : null,
  })
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
