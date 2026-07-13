// Helper generico de exportacion (TRD.md 4.8): arma un .xlsx en el navegador
// a partir de un arreglo de objetos planos, sin carga de computo en el servidor.
//
// xlsx (SheetJS) pesa ~1 MB y solo hace falta cuando el usuario efectivamente
// exporta. Se importa de forma diferida (dynamic import) para que NO forme parte
// del bundle inicial de las paginas que muestran el boton de exportar (Kardex,
// Reportes): la libreria se descarga recien al primer clic en "Exportar Excel".
export async function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const XLSX = await import("xlsx")
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
