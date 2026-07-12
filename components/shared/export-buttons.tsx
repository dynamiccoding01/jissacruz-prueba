"use client"

import { FileDown, FileSpreadsheet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { exportToExcel } from "@/lib/excel/export-to-excel"

export function ExportButtons({
  pdfHref,
  excelData,
  excelFilename,
}: {
  pdfHref: string
  excelData: Record<string, unknown>[]
  excelFilename: string
}) {
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
        onClick={() => exportToExcel(excelData, excelFilename)}
        disabled={excelData.length === 0}
      >
        <FileSpreadsheet className="size-4" /> Exportar Excel
      </Button>
    </div>
  )
}
