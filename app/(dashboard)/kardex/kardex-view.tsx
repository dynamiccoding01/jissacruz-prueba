"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { es } from "date-fns/locale"

import { StockBadge } from "@/components/shared/stock-badge"
import { TablaDatos } from "@/components/shared/tabla-datos"
import { ExportButtons } from "@/components/shared/export-buttons"
import { ETIQUETA_MOVIMIENTO, type TipoMovimiento } from "@/lib/kardex"

export type MovimientoConSaldo = {
  id: string
  tipo_movimiento: TipoMovimiento
  cantidad: number
  costo_unitario: number
  motivo: string | null
  creado_en: string
  saldo: number
}

export function KardexView({
  producto,
  movimientos,
}: {
  producto: { id: string; codigo: string; descripcion: string; stock_actual: number; stock_minimo: number }
  movimientos: MovimientoConSaldo[]
}) {
  // mas reciente primero para lectura tipo "estado de cuenta"
  const filas = [...movimientos].reverse()

  const columns: ColumnDef<MovimientoConSaldo>[] = [
    {
      accessorKey: "creado_en",
      header: "Fecha",
      cell: ({ row }) =>
        format(new Date(row.original.creado_en), "dd/MM/yyyy HH:mm", { locale: es }),
    },
    {
      accessorKey: "tipo_movimiento",
      header: "Movimiento",
      cell: ({ row }) => ETIQUETA_MOVIMIENTO[row.original.tipo_movimiento],
    },
    { accessorKey: "cantidad", header: "Cantidad" },
    {
      accessorKey: "costo_unitario",
      header: "Costo",
      cell: ({ row }) => `Bs ${Number(row.original.costo_unitario).toFixed(2)}`,
    },
    { accessorKey: "saldo", header: "Saldo" },
    {
      accessorKey: "motivo",
      header: "Motivo",
      cell: ({ row }) => row.original.motivo ?? "—",
    },
  ]

  const excelData = filas.map((m) => ({
    Fecha: format(new Date(m.creado_en), "dd/MM/yyyy HH:mm"),
    Movimiento: ETIQUETA_MOVIMIENTO[m.tipo_movimiento],
    Cantidad: m.cantidad,
    Costo: m.costo_unitario,
    Saldo: m.saldo,
    Motivo: m.motivo ?? "",
  }))

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">{producto.codigo}</h2>
          <p className="text-sm text-muted-foreground">{producto.descripcion}</p>
          <div className="mt-2">
            <StockBadge stockActual={producto.stock_actual} stockMinimo={producto.stock_minimo} />
          </div>
        </div>
        <ExportButtons
          pdfHref={`/api/pdf/kardex?producto=${producto.id}`}
          excelData={excelData}
          excelFilename={`kardex-${producto.codigo}`}
        />
      </div>

      <TablaDatos
        columns={columns}
        data={filas}
        mensajeVacio="Este producto todavía no tiene movimientos de Kardex."
      />
    </div>
  )
}
