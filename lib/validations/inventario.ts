import { z } from "zod"

const costoOpcional = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  z.coerce.number().min(0, "El costo no puede ser negativo").optional()
)

export const ajusteStockSchema = z.object({
  tipo: z.enum(["entrada", "salida"]),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
  motivo: z.string().min(1, "El motivo es obligatorio"),
  costo_unitario: costoOpcional,
})

export type AjusteStockValues = z.output<typeof ajusteStockSchema>
export type AjusteStockInput = z.input<typeof ajusteStockSchema>
