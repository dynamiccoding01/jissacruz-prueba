import { z } from "zod"

export const sucursalSchema = z.object({
  codigo: z.string().min(1, "El código es obligatorio"),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
})

export type SucursalValues = z.infer<typeof sucursalSchema>
