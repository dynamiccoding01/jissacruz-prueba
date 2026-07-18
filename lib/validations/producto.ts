import { z } from "zod"

export const codigoEquivalenteSchema = z.object({
  codigo_equivalente: z.string().min(1, "El código es obligatorio"),
  fabricante: z.string().optional(),
})

// convierte "" (input vacio) en undefined antes de intentar coercionar a numero
const anioOpcional = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.number().int().optional()
)

export const vehiculoCompatibleSchema = z.object({
  marca: z.string().min(1, "La marca es obligatoria"),
  modelo: z.string().min(1, "El modelo es obligatorio"),
  anio_desde: anioOpcional,
  anio_hasta: anioOpcional,
})

// C3: escala de precio por mayor. La fecha viaja como string del <input type="date">
// ("" = sin límite); la action la normaliza a null.
export const precioMayorSchema = z.object({
  cantidad_minima: z.coerce.number().int().min(2, "La cantidad mínima debe ser 2 o más"),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  vigente_hasta: z.string().optional(),
})

export const productoSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio"),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
  linea_marca: z.string().optional(),
  unidad_medida: z.string().min(1, "La unidad de medida es obligatoria"),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  stock_minimo: z.coerce.number().int().min(0, "El stock mínimo no puede ser negativo"),
  imagen_url: z.string().optional().nullable(),
  codigos_equivalentes: z.array(codigoEquivalenteSchema),
  vehiculos_compatibles: z.array(vehiculoCompatibleSchema),
  precios_mayor: z.array(precioMayorSchema),
})

// Output: lo que queda despues de validar/coercionar (lo que reciben las Server Actions).
export type ProductoFormValues = z.output<typeof productoSchema>
// Input: lo que realmente contienen los campos del formulario antes de validar.
export type ProductoFormInput = z.input<typeof productoSchema>
