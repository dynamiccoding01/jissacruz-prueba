// Tipos y constantes compartidos de reportes. SIN "server-only" ni Supabase:
// este módulo lo importan tanto los Server Components como el explorer cliente.

export type ReporteTipo = "ventas" | "proformas" | "mas_vendidos" | "inventario" | "rentabilidad"
export type Periodo = "diario" | "semanal" | "mensual"

export const REPORTE_LABEL: Record<ReporteTipo, string> = {
  ventas: "Ventas por período",
  proformas: "Proformas",
  mas_vendidos: "Productos más vendidos",
  inventario: "Estado de inventario",
  rentabilidad: "Rentabilidad",
}

export type Columna = { key: string; label: string; align?: "left" | "right" }
export type Fila = Record<string, string | number>

// Bloque adicional opcional dentro de un reporte (p. ej. el stock en tránsito
// dentro del reporte de inventario): su propia tabla con título.
export type BloqueReporte = {
  titulo: string
  columnas: Columna[]
  filas: Fila[]
  // Nombre de la hoja en el Excel (máx. 31 caracteres, sin / \ ? * [ ]).
  hojaExcel?: string
  // Si viene, el bloque se muestra aunque no tenga filas, con este mensaje.
  mensajeVacio?: string
  // Columna descriptiva (la más ancha) en el PDF. Default 1.
  columnaAncha?: number
}

export type ReporteResultado = {
  tipo: ReporteTipo
  titulo: string
  subtitulo: string
  columnas: Columna[]
  filas: Fila[]
  resumen: { label: string; value: string }[]
  // total2: segunda serie opcional (p. ej. sin factura en Rentabilidad).
  grafico?: { etiqueta: string; total: number; total2?: number }[]
  // Nombres de las series del gráfico (leyenda y tooltip); si hay total2, va las dos.
  graficoSeries?: { total: string; total2?: string }
  // Título opcional sobre la tabla principal (p. ej. "Con factura").
  tituloTabla?: string
  // Nombre de la hoja principal en el Excel (default "Datos").
  hojaExcel?: string
  bloqueExtra?: BloqueReporte
}
