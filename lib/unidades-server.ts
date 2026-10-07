import "server-only"

import { getUnidadesActivas } from "@/lib/datos-cacheados"

// PLAN_7 · T1: código corto de la unidad de un producto (PZA, KG) para mostrarlo
// en la proforma y en su PDF. Sale del catálogo `unidades_medida` (cacheado); si
// el producto no tiene unidad del catálogo se busca por el nombre guardado en el
// texto `productos.unidad_medida`, y si tampoco coincide se muestra ese texto.
export type UnidadCorta = (unidadId: string | null | undefined, texto: string | null | undefined) => string

export async function resolverUnidadCorta(): Promise<UnidadCorta> {
  const unidades = await getUnidadesActivas()
  const porId = new Map(unidades.map((u) => [u.id, u.codigo]))
  const porNombre = new Map(unidades.map((u) => [u.nombre.trim().toLowerCase(), u.codigo]))

  return (unidadId, texto) => {
    const nombre = (texto ?? "").trim()
    return (
      (unidadId ? porId.get(unidadId) : undefined) ??
      porNombre.get(nombre.toLowerCase()) ??
      (nombre || "unidad")
    )
  }
}
