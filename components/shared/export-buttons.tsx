"use client"

import { FileDown, FileSpreadsheet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { exportToExcel } from "@/lib/excel/export-to-excel"

export function ExportButtons({
  pdfHref,
  excelData,
  excelFilename,
  excelHojasExtra,
  excelHojaPrincipal,
}: {
  pdfHref: string
  excelData: Record<string, unknown>[]
  excelFilename: string
  excelHojasExtra?: { nombre: string; data: Record<string, unknown>[] }[]
  excelHojaPrincipal?: string
}) {
  const hayDatos =
    excelData.length > 0 || (excelHojasExtra ?? []).some((h) => h.data.length > 0)
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" asChild>
        <a href={pdfHref} target="_blank" rel="noopener noreferrer">
          <FileDown className="size-4" /> Exportar PDF
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToExcel(excelData, excelFilename, excelHojasExtra, excelHojaPrincipal)}
        disabled={!hayDatos}
      >
        <FileSpreadsheet className="size-4" /> Exportar Excel
      </Button>
    </div>
  )
}
