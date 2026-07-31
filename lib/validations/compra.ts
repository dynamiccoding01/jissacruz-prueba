import { z } from "zod"

export const ordenCompraItemSchema = z
  .object({
    producto_id: z.string().uuid("Seleccioná un producto"),
    codigo: z.string(),
    descripcion: z.string(),
    cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a 0"),
    costo_unitario: z.coerce.number().min(0, "El costo no puede ser negativo"),
    // Precio al que se va a vender. Se aplica al producto AL RECIBIR la orden.
    precio_venta: z.coerce.number().min(0, "El precio no puede ser negativo"),
  })
  // La regla del cliente: no se compra más caro de lo que se vende. El mismo
  // check está en la BD (script 32), acá es para dar el mensaje en el campo.
  .refine((i) => i.precio_venta > i.costo_unitario, {
    message: "El precio de venta debe ser mayor al costo de compra",
    path: ["precio_venta"],
  })

export const ordenCompraSchema = z.object({
  proveedor_id: z.string().uuid("Seleccioná un proveedor"),
  notas: z.string().optional(),
  items: z.array(ordenCompraItemSchema).min(1, "Agregá al menos un producto"),
})

export type OrdenCompraValues = z.output<typeof ordenCompraSchema>
export type OrdenCompraInput = z.input<typeof ordenCompraSchema>
export type OrdenCompraItemInput = z.input<typeof ordenCompraItemSchema>
