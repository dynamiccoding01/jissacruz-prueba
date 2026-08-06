// Los 6 tipos que acepta el check de `kardex_movimientos` en la BD. Antes acá
// solo estaban 4: los de traspaso (script 19) nunca se agregaron. Como el tipo
// declaraba 4 y los datos traen 6, `tsc` pasaba limpio y el bug era invisible:
// la etiqueta salía vacia y, peor, `entrada_traspaso` se RESTABA del saldo.
export type TipoMovimiento =
  | "entrada_compra"
  | "salida_venta"
  | "ajuste_entrada"
  | "ajuste_salida"
  | "salida_traspaso"
  | "entrada_traspaso"

// Los tipos que SUMAN al saldo. El resto resta. Se define como set explícito en
// vez de una condición suelta para que al agregar un tipo nuevo haya que decidir
// de qué lado va, en lugar de que caiga en "resta" por descarte.
const TIPOS_ENTRADA = new Set<TipoMovimiento>([
  "entrada_compra",
  "ajuste_entrada",
  "entrada_traspaso",
])

export function esEntrada(tipo: TipoMovimiento): boolean {
  return TIPOS_ENTRADA.has(tipo)
}

export const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada_compra: "Entrada por compra",
  salida_venta: "Salida por venta",
  ajuste_entrada: "Ajuste de entrada",
  ajuste_salida: "Ajuste de salida",
  salida_traspaso: "Salida por traspaso",
  entrada_traspaso: "Entrada por traspaso",
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
    saldo += esEntrada(m.tipo_movimiento) ? m.cantidad : -m.cantidad
    return { ...m, saldo }
  })
}
