export type TipoMovimiento =
  | "entrada_compra"
  | "salida_venta"
  | "ajuste_entrada"
  | "ajuste_salida"

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada_compra: "Entrada por compra",
  salida_venta: "Salida por venta",
  ajuste_entrada: "Ajuste de entrada",
  ajuste_salida: "Ajuste de salida",
}

export type MovimientoBase = {
  tipo_movimiento: TipoMovimiento
  cantidad: number
}

// Recorre los movimientos en orden cronologico (mas antiguo primero) y les
// agrega el saldo acumulado. El array de entrada debe venir ordenado asc.
export function calcularSaldo<T extends MovimientoBase>(
  movimientos: T[]
): (T & { saldo: number })[] {
  let saldo = 0
  return movimientos.map((m) => {
    saldo += m.tipo_movimiento === "entrada_compra" || m.tipo_movimiento === "ajuste_entrada"
      ? m.cantidad
      : -m.cantidad
    return { ...m, saldo }
  })
}
