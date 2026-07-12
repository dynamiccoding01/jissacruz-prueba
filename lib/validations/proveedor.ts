import { z } from "zod"

export const proveedorSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  contacto: z.string().optional(),
  nit: z.string().optional(),
  direccion: z.string().optional(),
})

export type ProveedorValues = z.infer<typeof proveedorSchema>
