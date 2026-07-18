// C3 · paso 2 — Precio por mayor según cantidad.
// Las escalas llegan del servidor YA filtradas por vigencia (vigente_hasta) y
// ordenadas por cantidad_minima; acá solo se elige la que corresponde.

export type EscalaPrecio = {
  cantidad_minima: number
  precio: number
}

/**
 * Devuelve el precio unitario que corresponde a la cantidad:
 * la escala de mayor cantidad_minima que la cantidad alcance,
 * o el precio base si no alcanza ninguna.
 */
export function precioSegunCantidad(
  precioBase: number,
  escalas: EscalaPrecio[] | undefined,
  cantidad: number
): number {
  if (!escalas || escalas.length === 0 || !Number.isFinite(cantidad)) return precioBase
  let precio = precioBase
  for (const e of escalas) {
    if (cantidad >= e.cantidad_minima) precio = e.precio
  }
  return precio
}
