import { z } from "zod"

export const unidadSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio"),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  abreviatura: z.string().optional(),
})

export type UnidadValues = z.infer<typeof unidadSchema>
