// Helper de presentación de medidas (Sprint 6 · Parte I · Fase 2).
// Client-safe (sin "server-only"): lo usan el catálogo, el POS, las proformas y
// los PDFs. No duplicar el formateo en cada pantalla.

// PLAN_7 · T2: la medida es solo la etiqueta, un texto libre (p. ej.
// "110X140X12/2"). `valor` y `unidad` quedan únicamente para las filas cargadas
// antes de ese cambio, hasta que el script 45 las pase a texto.
export type Medida = { etiqueta: string; valor?: number | null; unidad?: string | null }

// Texto de una medida. Las viejas (con valor) se siguen viendo como antes:
// "A: 45,40MM" — formato es-BO (coma decimal), 2 decimales, sin espacio antes de
// la unidad. Es el mismo texto al que las convierte el script 45.
export function textoMedida(m: Medida): string {
  if (m.valor == null) return m.etiqueta
  return `${m.etiqueta}: ${Number(m.valor).toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  })}${m.unidad ?? ""}`
}

// "110X140X12/2 · REFORZADO". Respeta el orden en que llegan las medidas.
export function formatearMedidas(medidas: Medida[]): string {
  return medidas.map(textoMedida).join(" · ")
}
