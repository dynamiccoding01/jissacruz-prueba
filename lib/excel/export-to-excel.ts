import * as XLSX from "xlsx"

// Helper generico de exportacion (TRD.md 4.8): arma un .xlsx en el navegador
// a partir de un arreglo de objetos planos, sin carga de computo en el servidor.
export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Datos")
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}
