"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { Download, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TablaDatos } from "@/components/shared/tabla-datos"

export type CotizacionFila = {
  id: string
  numero: string
  creado_en: string
  total: number
  clientes: { id: string; nombre: string } | null
}

export function CotizacionesExplorer({
  cotizaciones,
  clientes,
}: {
  cotizaciones: CotizacionFila[]
  clientes: { id: string; nombre: string }[]
}) {
  const [clienteFiltro, setClienteFiltro] = useState("todos")
  // T6: por defecto se muestran las cotizaciones DEL DÍA. Se setea en el cliente
  // (useEffect) para que "hoy" sea la fecha local del navegador y no haya
  // desajuste de hidratación con el render del servidor.
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")

  useEffect(() => {
    const hoy = format(new Date(), "yyyy-MM-dd")
    setFechaDesde(hoy)
    setFechaHasta(hoy)
  }, [])

  const filtradas = useMemo(
    () =>
      cotizaciones.filter((c) => {
        if (clienteFiltro !== "todos" && c.clientes?.id !== clienteFiltro) return false
        const fechaLocal = format(new Date(c.creado_en), "yyyy-MM-dd")
        if (fechaDesde && fechaLocal < fechaDesde) return false
        if (fechaHasta && fechaLocal > fechaHasta) return false
        return true
      }),
    [cotizaciones, clienteFiltro, fechaDesde, fechaHasta]
  )

  const columns: ColumnDef<CotizacionFila>[] = [
    { accessorKey: "numero", header: "Número" },
    {
      accessorKey: "creado_en",
      header: "Fecha",
      cell: ({ row }) => format(new Date(row.original.creado_en), "dd/MM/yyyy HH:mm"),
    },
    {
      id: "cliente",
      header: "Cliente",
      cell: ({ row }) => row.original.clientes?.nombre ?? "SIN NOMBRE",
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => `Bs ${Number(row.original.total).toFixed(2)}`,
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <a href={`/api/pdf/cotizacion/${row.original.id}`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon" title="Descargar / imprimir PDF">
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
        <div className="flex flex-wrap items-center gap-3">
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
          <div className="flex items-center gap-1.5">
            <Label htmlFor="fecha-desde" className="text-xs text-muted-foreground">
              Desde
            </Label>
            <Input
              id="fecha-desde"
              type="date"
              className="w-40"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
            <Label htmlFor="fecha-hasta" className="text-xs text-muted-foreground">
              Hasta
            </Label>
            <Input
              id="fecha-hasta"
              type="date"
              className="w-40"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFechaDesde("")
                setFechaHasta("")
              }}
            >
              Ver todas
            </Button>
          </div>
        </div>

        <Button asChild>
          <Link href="/cotizacion/nueva">
            <Plus className="size-4" /> Nueva cotización
          </Link>
        </Button>
      </div>

      <TablaDatos columns={columns} data={filtradas} mensajeVacio="No hay cotizaciones en el rango elegido." />
    </div>
  )
}
