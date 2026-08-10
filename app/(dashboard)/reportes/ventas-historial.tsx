"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { Download } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TablaDatos } from "@/components/shared/tabla-datos"

export type VentaFila = {
  id: string
  numero: string
  creado_en: string
  total: number
  proforma_origen_id: string | null
  clientes: { id: string; nombre: string } | null
}

export function VentasHistorial({
  ventas,
  clientes,
}: {
  ventas: VentaFila[]
  clientes: { id: string; nombre: string }[]
}) {
  const [clienteFiltro, setClienteFiltro] = useState("todos")

  const filtradas = useMemo(
    () =>
      ventas.filter((v) => {
        if (clienteFiltro !== "todos" && v.clientes?.id !== clienteFiltro) return false
        return true
      }),
    [ventas, clienteFiltro]
  )

  const columns: ColumnDef<VentaFila>[] = [
    { accessorKey: "numero", header: "Número" },
    {
      accessorKey: "creado_en",
      header: "Fecha",
      cell: ({ row }) => format(new Date(row.original.creado_en), "dd/MM/yyyy HH:mm"),
    },
    {
      id: "cliente",
      header: "Cliente",
      cell: ({ row }) => row.original.clientes?.nombre ?? "Consumidor final",
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => `Bs ${Number(row.original.total).toFixed(2)}`,
    },
    {
      id: "origen",
      header: "Origen",
      cell: ({ row }) =>
        row.original.proforma_origen_id ? (
          <Badge variant="secondary">Proforma</Badge>
        ) : (
          <Badge variant="outline">POS</Badge>
        ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <a href={`/api/pdf/venta/${row.original.id}`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon" title="Descargar comprobante">
              <Download className="size-4" />
            </Button>
          </a>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Historial de ventas</h2>
        <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filtrar por cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los clientes</SelectItem>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TablaDatos columns={columns} data={filtradas} mensajeVacio="Todavía no hay ventas registradas." />
    </div>
  )
}
