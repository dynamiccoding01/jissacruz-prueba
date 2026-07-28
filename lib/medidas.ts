// Helper de presentación de medidas (Sprint 6 · Parte I · Fase 2).
// Client-safe (sin "server-only"): lo usan el catálogo, el POS, las proformas y
// los PDFs. No duplicar el formateo en cada pantalla.

export type Medida = { etiqueta: string; valor: number; unidad: string }

// "A: 45,40MM  B: 17,00MM" — formato es-BO (coma decimal), 2 decimales, sin
// espacio antes de la unidad. Respeta el orden en que llegan las medidas.
export function formatearMedidas(medidas: Medida[]): string {
  return medidas
    .map(
      (m) =>
        `${m.etiqueta}: ${Number(m.valor).toLocaleString("es-BO", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}${m.unidad}`
    )
    .join("  ")
}
