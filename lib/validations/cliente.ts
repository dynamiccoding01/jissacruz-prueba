import { z } from "zod"

export const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  ci_nit: z.string().optional(),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
})

export type ClienteValues = z.infer<typeof clienteSchema>
