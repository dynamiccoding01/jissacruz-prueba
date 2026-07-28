import { z } from "zod"

// Código de OTRO fabricante que hace la misma pieza. Q1 (Sprint 6): se quitó
// la columna `fabricante` — la tabla guarda solo el código.
export const codigoEquivalenteSchema = z.object({
  codigo_equivalente: z.string().min(1, "El código es obligatorio"),
})

// Código del fabricante ORIGINAL (OEM) de la pieza. Un producto tiene N.
export const codigoOriginalSchema = z.object({
  codigo_original: z.string().min(1, "El código es obligatorio"),
})

// Medida estructurada del producto (Q2: la etiqueta es obligatoria).
export const medidaSchema = z.object({
  etiqueta: z.string().min(1, "La etiqueta es obligatoria"),
  valor: z.coerce.number().positive("El valor debe ser mayor a 0"),
  unidad: z.enum(["MM", "CM", "PULG"]).default("MM"),
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

// R8 · Deduplica las listas hijas ANTES de que la Server Action las escriba.
// El guardado de producto borra los hijos y los reinserta sin transacción; si
// el usuario tipea dos veces la misma clave, el insert falla por el UNIQUE
// DESPUÉS de que el delete ya borró todo. Deduplicar acá mata ese disparador.
// Conserva la primera aparición de cada clave.
function dedupePorClave<T>(clave: (item: T) => string) {
  return (items: T[]): T[] => {
    const vistos = new Set<string>()
    return items.filter((item) => {
      const k = clave(item)
      if (vistos.has(k)) return false
      vistos.add(k)
      return true
    })
  }
}

export const productoSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio"),
  descripcion: z.string().min(1, "La descripción es obligatoria"),
  linea_marca: z.string().optional(),
  unidad_medida: z.string().min(1, "La unidad de medida es obligatoria"),
  precio: z.coerce.number().min(0, "El precio no puede ser negativo"),
  stock_minimo: z.coerce.number().int().min(0, "El stock mínimo no puede ser negativo"),
  imagen_url: z.string().optional().nullable(),
  codigos_equivalentes: z
    .array(codigoEquivalenteSchema)
    .transform(dedupePorClave((c) => c.codigo_equivalente.trim().toUpperCase())),
  codigos_originales: z
    .array(codigoOriginalSchema)
    .transform(dedupePorClave((c) => c.codigo_original.trim().toUpperCase())),
  medidas: z
    .array(medidaSchema)
    .transform(dedupePorClave((m) => m.etiqueta.trim().toUpperCase())),
  vehiculos_compatibles: z
    .array(vehiculoCompatibleSchema)
    .transform(
      dedupePorClave((v) => `${v.marca.trim().toUpperCase()}|${v.modelo.trim().toUpperCase()}`)
    ),
  precios_mayor: z
    .array(precioMayorSchema)
    .transform(dedupePorClave((p) => String(p.cantidad_minima))),
})

// Output: lo que queda despues de validar/coercionar (lo que reciben las Server Actions).
export type ProductoFormValues = z.output<typeof productoSchema>
// Input: lo que realmente contienen los campos del formulario antes de validar.
export type ProductoFormInput = z.input<typeof productoSchema>
