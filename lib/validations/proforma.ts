import { z } from "zod"

export type DescuentoTipo = "porcentaje" | "monto_fijo" | null

// El formulario usa "ninguno" como centinela. NO se transforma en el schema
// (un transform haría input≠output y rompería el Resolver de react-hook-form).
// La normalización "ninguno" -> null se hace en la action con normalizarDescuento().
const descuentoTipo = z.enum(["ninguno", "porcentaje", "monto_fijo"]).default("ninguno")

export type DescuentoTipoForm = "ninguno" | "porcentaje" | "monto_fijo"

// Convierte el centinela del formulario al valor que acepta la BD (null | enum).
export function normalizarDescuento(tipo: unknown): DescuentoTipo {
  return tipo === "porcentaje" || tipo === "monto_fijo" ? tipo : null
}

export const proformaItemSchema = z.object({
  producto_id: z.string().uuid("Seleccioná un producto"),
  codigo: z.string(),
  descripcion: z.string(),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
  precio_unitario: z.coerce.number().min(0, "El precio no puede ser negativo"),
  descuento_tipo: descuentoTipo,
  descuento_valor: z.coerce.number().min(0, "El descuento no puede ser negativo").default(0),
})

export const proformaSchema = z.object({
  cliente_id: z.string().uuid("Seleccioná un cliente"),
  tipo_pago: z.string().optional(),
  plazo_validez_dias: z.coerce.number().int().min(0).default(15),
  // P10: "Tiempo de entrega: N día(s)" del modelo del cliente. Opcional; un
  // input vacío coerciona a 0 y la action lo guarda como null (sin leyenda).
  tiempo_entrega_dias: z.coerce.number().int().min(0).default(0),
  glosa: z.string().optional(),
  descuento_tipo: descuentoTipo,
  descuento_valor: z.coerce.number().min(0).default(0),
  impuesto_porcentaje: z.coerce.number().min(0).max(100).default(0),
  items: z.array(proformaItemSchema).min(1, "Agregá al menos un producto"),
})

export type ProformaValues = z.output<typeof proformaSchema>
export type ProformaInput = z.input<typeof proformaSchema>
export type ProformaItemInput = z.input<typeof proformaItemSchema>

// ---------- Cálculo de totales (fuente única de verdad) ----------
const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// Los tipos se aceptan laxos (unknown) porque react-hook-form observa los
// campos con z.coerce como `unknown`; internamente se coerciona con Number().
function montoDescuento(base: number, tipo: unknown, valor: unknown) {
  const v = Number(valor) || 0
  if (tipo === "porcentaje") return (base * v) / 100
  if (tipo === "monto_fijo") return v
  return 0
}

export function calcularSubtotalLinea(
  cantidad: unknown,
  precio: unknown,
  tipo: unknown,
  valor: unknown
) {
  const base = (Number(cantidad) || 0) * (Number(precio) || 0)
  return round2(Math.max(0, base - montoDescuento(base, tipo, Number(valor))))
}

export type LineaCalculable = {
  cantidad?: unknown
  precio_unitario?: unknown
  descuento_tipo?: unknown
  descuento_valor?: unknown
}

export function calcularTotales(
  items: LineaCalculable[],
  descuentoTipoGlobal: unknown,
  descuentoValorGlobal: unknown,
  impuestoPorcentaje: unknown
) {
  const subtotal = round2(
    items.reduce(
      (acc, i) =>
        acc +
        calcularSubtotalLinea(i.cantidad, i.precio_unitario, i.descuento_tipo, i.descuento_valor),
      0
    )
  )
  const descuento = round2(montoDescuento(subtotal, descuentoTipoGlobal, Number(descuentoValorGlobal)))
  const baseImponible = Math.max(0, round2(subtotal - descuento))
  const impuesto = round2((baseImponible * (Number(impuestoPorcentaje) || 0)) / 100)
  const total = round2(baseImponible + impuesto)
  return { subtotal, descuento, baseImponible, impuesto, total }
}
