// Helper generico de exportacion (TRD.md 4.8): arma un .xlsx en el navegador
// a partir de un arreglo de objetos planos, sin carga de computo en el servidor.
//
// xlsx (SheetJS) pesa ~1 MB y solo hace falta cuando el usuario efectivamente
// exporta. Se importa de forma diferida (dynamic import) para que NO forme parte
// del bundle inicial de las paginas que muestran el boton de exportar (Kardex,
// Reportes): la libreria se descarga recien al primer clic en "Exportar Excel".
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  // Hojas adicionales opcionales (p. ej. "En tránsito" del reporte de inventario).
  hojasExtra?: { nombre: string; data: Record<string, unknown>[] }[]
) {
  const XLSX = await import("xlsx")
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data), "Datos")
  for (const hoja of hojasExtra ?? []) {
    if (hoja.data.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(hoja.data), hoja.nombre)
    }
  }
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
