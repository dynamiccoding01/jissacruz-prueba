"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { logError } from "@/lib/log"
import { datosBusquedaPorProducto } from "@/lib/producto-busqueda-server"
import type { Medida } from "@/lib/medidas"

export type TraspasoItemInput = {
  producto_id: string
  cantidad: number
}

// Búsqueda propia del módulo Pedido, con el mismo contrato que la de proforma y
// compra: respeta los criterios que marca el usuario y suma unidad, medidas y
// códigos originales. Antes usaba `searchProductos` sin criterios.
export type ProductoBusquedaPedido = {
  id: string
  codigo: string
  descripcion: string
  unidad: string
  medidas: Medida[]
  originales: string[]
}

export async function buscarProductosParaPedido(
  query: string,
  campos: string[] = []
): Promise<ProductoBusquedaPedido[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) {
    logError("traspasos.buscarProductosParaPedido", error, { query, campos })
    return []
  }

  const filas = (data ?? []) as {
    id: string
    codigo: string
    descripcion: string
    unidad_medida: string
  }[]
  const datos = await datosBusquedaPorProducto(supabase, filas.map((p) => p.id))
  return filas.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descripcion: p.descripcion,
    unidad: p.unidad_medida,
    medidas: datos.get(p.id)?.medidas ?? [],
    originales: datos.get(p.id)?.originales ?? [],
  }))
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
