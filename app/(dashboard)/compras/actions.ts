"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { getPerfil } from "@/lib/auth/session"
import { ordenCompraSchema, type OrdenCompraInput } from "@/lib/validations/compra"

export async function buscarProductosParaCompra(query: string, campos: string[] = []) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("fn_buscar_productos", {
    p_query: query,
    p_campos: campos,
  })
  if (error) return []
  return (data ?? []) as { id: string; codigo: string; descripcion: string }[]
}

export async function createOrdenCompra(values: OrdenCompraInput) {
  const parsed = ordenCompraSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos de la orden." }
  }

  const supabase = await createClient()
  const perfil = await getPerfil()

  const { data: orden, error } = await supabase
    .from("ordenes_compra")
    .insert({
      proveedor_id: parsed.data.proveedor_id,
      notas: parsed.data.notas || null,
      creado_por: perfil?.id,
      // Sucursal destino = la del usuario que crea la orden (C2 · paso 3c).
      // La recepción (fn_recibir_orden_compra) hará entrar el stock aquí.
      sucursal_id: perfil?.sucursal_id ?? null,
    })
    .select("id")
    .single()

  if (error || !orden) {
    return { error: "No se pudo crear la orden de compra." }
  }

  const { error: itemsError } = await supabase.from("orden_compra_items").insert(
    parsed.data.items.map((item) => ({
      orden_compra_id: orden.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      costo_unitario: item.costo_unitario,
    }))
  )

  if (itemsError) {
    return { error: "No se pudieron guardar los ítems de la orden." }
  }

  revalidatePath("/compras")
  return { id: orden.id }
}

export async function recibirOrdenCompra(ordenId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_recibir_orden_compra", { p_orden_id: ordenId })
  if (error) {
    return { error: error.message }
  }

  revalidatePath("/compras")
  revalidatePath("/inventario")
  revalidatePath("/kardex")
  revalidatePath("/productos")
  return { success: true }
}
