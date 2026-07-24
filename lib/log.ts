import "server-only"

// Logging minimo de errores del servidor. En Vercel estos console.error
// aparecen en los Function Logs del deployment; en desarrollo, en la terminal.
// `contexto` identifica modulo y accion, p. ej. "ventas.registrarVenta".
export function logError(contexto: string, error: unknown, extra?: Record<string, unknown>) {
  const detalle =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error
  console.error(`[${contexto}]`, JSON.stringify({ detalle, ...extra }, null, 0))
}
