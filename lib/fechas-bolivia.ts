// Bolivia (America/La_Paz) está en UTC−4 todo el año (no tiene horario de
// verano). En Vercel el servidor corre en UTC: sin esto, después de las 20:00 de
// Bolivia "hoy" ya sería el día siguiente.
const DESFASE_MS = 4 * 60 * 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000

/** Fecha calendario de Bolivia (yyyy-MM-dd) de un instante. */
export function diaBolivia(instante: Date | string): string {
  return new Date(new Date(instante).getTime() - DESFASE_MS).toISOString().slice(0, 10)
}

/** Instante de la medianoche de Bolivia de hace `diasAtras` días (0 = hoy). */
export function inicioDiaBolivia(diasAtras = 0, ahora: Date = new Date()): Date {
  const medianocheUtc = Date.parse(`${diaBolivia(ahora)}T00:00:00Z`) - diasAtras * DIA_MS
  return new Date(medianocheUtc + DESFASE_MS)
}
