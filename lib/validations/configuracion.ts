import { z } from "zod"

export const empresaSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio"),
  nit: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  stock_minimo_default: z
    .number({ error: "Debe ser un número" })
    .int("Debe ser un número entero")
    .min(0, "No puede ser negativo"),
})

export type EmpresaValues = z.infer<typeof empresaSchema>

export const nuevoUsuarioSchema = z.object({
  nombre_completo: z.string().min(1, "El nombre es obligatorio"),
  email: z.string().min(1, "El correo es obligatorio").email("Correo inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  rol: z.enum(["admin", "vendedor"]),
})

export type NuevoUsuarioValues = z.infer<typeof nuevoUsuarioSchema>
