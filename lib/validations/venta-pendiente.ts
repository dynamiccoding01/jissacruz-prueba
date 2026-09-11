import { z } from "zod"

import { ventaItemSchema } from "./venta"

// El pedido de venta (PLAN_5 · T5) comparte el ítem y los cálculos con la venta,
// pero NO lleva tipo_pago ni con_factura: eso lo define el cajero al confirmar.
export { calcularTotales, calcularSubtotalLinea, normalizarDescuento } from "./venta"

const descuentoTipo = z.enum(["ninguno", "monto_fijo"]).default("ninguno")

export const ventaPendienteSchema = z.object({
  cliente_id: z.string().uuid().optional().or(z.literal("")),
  descuento_tipo: descuentoTipo,
  descuento_valor: z.coerce.number().min(0).default(0),
  impuesto_porcentaje: z.coerce.number().min(0).max(100).default(0),
  items: z.array(ventaItemSchema).min(1, "Agregá al menos un producto"),
})

export type VentaPendienteValues = z.output<typeof ventaPendienteSchema>
export type VentaPendienteInput = z.input<typeof ventaPendienteSchema>
