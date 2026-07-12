"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { ajusteStockSchema, type AjusteStockInput } from "@/lib/validations/inventario"

export async function ajustarStock(productoId: string, values: AjusteStockInput) {
  const parsed = ajusteStockSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Revisá los datos del ajuste." }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc("fn_ajuste_stock", {
    p_producto_id: productoId,
    p_cantidad: parsed.data.cantidad,
    p_tipo: parsed.data.tipo,
    p_motivo: parsed.data.motivo,
    p_costo_unitario: parsed.data.costo_unitario ?? null,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/inventario")
  revalidatePath("/kardex")
  return { success: true }
}
