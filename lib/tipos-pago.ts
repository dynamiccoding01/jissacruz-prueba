// Opciones de tipo de pago para proformas y ventas (T8).
// Lista fija por ahora; si más adelante se quiere configurable, se mueve a
// `configuracion_empresa` o a su propia tabla.
export const TIPOS_PAGO = ["Efectivo", "QR", "Transferencia", "Tarjeta", "Crédito"] as const

export type TipoPago = (typeof TIPOS_PAGO)[number]
