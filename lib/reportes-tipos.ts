// Tipos y constantes compartidos de reportes. SIN "server-only" ni Supabase:
// este módulo lo importan tanto los Server Components como el explorer cliente.

export type ReporteTipo = "ventas" | "proformas" | "mas_vendidos" | "inventario"
export type Periodo = "diario" | "semanal" | "mensual"

export const REPORTE_LABEL: Record<ReporteTipo, string> = {
  ventas: "Ventas por período",
  proformas: "Proformas",
  mas_vendidos: "Productos más vendidos",
  inventario: "Estado de inventario",
}

export type Columna = { key: string; label: string; align?: "left" | "right" }
export type Fila = Record<string, string | number>

export type ReporteResultado = {
  tipo: ReporteTipo
  titulo: string
  subtitulo: string
  columnas: Columna[]
  filas: Fila[]
  resumen: { label: string; value: string }[]
  grafico?: { etiqueta: string; total: number }[]
}
