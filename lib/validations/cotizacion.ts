import { z } from "zod"

// La cotización comparte el modelo de línea y los cálculos de totales con la
// proforma (funciones puras). Se reexportan para no duplicar la fuente de verdad.
export {
  calcularTotales,
  calcularSubtotalLinea,
  normalizarDescuento,
} from "./proforma"

// El formulario usa "ninguno" como centinela (igual que proforma). La
// normalización a null la hace la action con normalizarDescuento().
const descuentoTipo = z.enum(["ninguno", "monto_fijo"]).default("ninguno")

export const cotizacionItemSchema = z.object({
  producto_id: z.string().uuid("Seleccioná un producto"),
  codigo: z.string(),
  descripcion: z.string(),
  // T3/T4: se arrastran para mostrar en la línea (no se persisten en la BD;
  // el PDF los relee del producto).
  unidad: z.string().optional().default("unidad"),
  linea_marca: z.string().nullable().optional(),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
  precio_unitario: z.coerce.number().min(0, "El precio no puede ser negativo"),
  descuento_tipo: descuentoTipo,
  descuento_valor: z.coerce.number().min(0, "El descuento no puede ser negativo").default(0),
})

export const cotizacionSchema = z.object({
  // Cliente OPCIONAL: una cotización puede ir SIN NOMBRE (imagen de referencia).
  cliente_id: z.string().uuid().optional().or(z.literal("")),
  tipo_pago: z.string().optional(),
  plazo_validez_dias: z.coerce.number().int().min(0).default(3),
  tiempo_entrega_dias: z.coerce.number().int().min(0).default(0),
  glosa: z.string().optional(),
  descuento_tipo: descuentoTipo,
  descuento_valor: z.coerce.number().min(0).default(0),
  impuesto_porcentaje: z.coerce.number().min(0).max(100).default(0),
  items: z.array(cotizacionItemSchema).min(1, "Agregá al menos un producto"),
})

export type CotizacionValues = z.output<typeof cotizacionSchema>
export type CotizacionInput = z.input<typeof cotizacionSchema>
export type CotizacionItemInput = z.input<typeof cotizacionItemSchema>
