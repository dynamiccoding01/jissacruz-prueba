import { z } from "zod"

import {
  calcularSubtotalLinea,
  calcularTotales,
  normalizarDescuento,
  type DescuentoTipo,
  type LineaCalculable,
} from "@/lib/validations/proforma"

export { calcularSubtotalLinea, calcularTotales, normalizarDescuento }
export type { DescuentoTipo, LineaCalculable }

// El formulario usa "ninguno" como centinela, igual que en proformas;
// la normalizacion a null la hace registrarVenta() antes de llamar la RPC.
const descuentoTipo = z.enum(["ninguno", "porcentaje", "monto_fijo"]).default("ninguno")

export const ventaItemSchema = z.object({
  producto_id: z.string().uuid("Seleccioná un producto"),
  codigo: z.string(),
  descripcion: z.string(),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
  precio_unitario: z.coerce.number().min(0, "El precio no puede ser negativo"),
  descuento_tipo: descuentoTipo,
  descuento_valor: z.coerce.number().min(0, "El descuento no puede ser negativo").default(0),
})

export const ventaSchema = z.object({
  cliente_id: z.string().uuid().optional().or(z.literal("")),
  descuento_tipo: descuentoTipo,
  descuento_valor: z.coerce.number().min(0).default(0),
  impuesto_porcentaje: z.coerce.number().min(0).max(100).default(0),
  items: z.array(ventaItemSchema).min(1, "Agregá al menos un producto"),
})

export type VentaValues = z.output<typeof ventaSchema>
export type VentaInput = z.input<typeof ventaSchema>
export type VentaItemInput = z.input<typeof ventaItemSchema>
