"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { addDays, addMonths, format, isBefore } from "date-fns"
import { Download, Eye, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { cn } from "@/lib/utils"
import { TablaDatos } from "@/components/shared/tabla-datos"

export type ProformaFila = {
  id: string
  numero: string
  creado_en: string
  plazo_validez_dias: number
  revalidada_en: string | null
  total: number
  estado: "vigente" | "convertida"
  clientes: { id: string; nombre: string } | null
}

type EstadoEfectivo = "vigente" | "pendiente" | "convertida" | "vencida"

// Estilo por estado (alineado con la vista vista_proformas del script 27).
const ESTADO_ESTILO: Record<EstadoEfectivo, string> = {
  vigente: "bg-green-100 text-green-800 border-green-300",
  pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  convertida: "bg-blue-100 text-blue-800 border-blue-300",
  vencida: "bg-gray-100 text-gray-700 border-gray-300",
}

const ESTADO_ETIQUETA: Record<EstadoEfectivo, string> = {
  vigente: "Vigente",
  pendiente: "Pendiente (revisar precios)",
  convertida: "Convertida",
  vencida: "Vencida",
}

// Misma regla que la vista vista_proformas (script 27): 3 estados + tope duro
// de 3 meses desde la creación (gana sobre todo).
function estadoEfectivo(p: ProformaFila): EstadoEfectivo {
  if (p.estado === "convertida") return "convertida"
  const ahora = new Date()
  if (isBefore(addMonths(new Date(p.creado_en), 3), ahora)) return "vencida"
  const base = p.revalidada_en ? new Date(p.revalidada_en) : new Date(p.creado_en)
  if (!isBefore(addDays(base, p.plazo_validez_dias), ahora)) return "vigente"
  return "pendiente"
}

export function ProformasExplorer({
  proformas,
  clientes,
}: {
  proformas: ProformaFila[]
  clientes: { id: string; nombre: string }[]
}) {
  const [clienteFiltro, setClienteFiltro] = useState("todos")
  const [estadoFiltro, setEstadoFiltro] = useState("todos")
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")

  const hayFiltroFecha = fechaDesde !== "" || fechaHasta !== ""

  const filtradas = useMemo(
    () =>
      proformas.filter((p) => {
        if (clienteFiltro !== "todos" && p.clientes?.id !== clienteFiltro) return false
        if (estadoFiltro !== "todos" && estadoEfectivo(p) !== estadoFiltro) return false
        // Compara por fecha local (yyyy-MM-dd), consistente con la columna Fecha
        const fechaLocal = format(new Date(p.creado_en), "yyyy-MM-dd")
        if (fechaDesde && fechaLocal < fechaDesde) return false
        if (fechaHasta && fechaLocal > fechaHasta) return false
        return true
      }),
    [proformas, clienteFiltro, estadoFiltro, fechaDesde, fechaHasta]
  )

  const columns: ColumnDef<ProformaFila>[] = [
    { accessorKey: "numero", header: "Número" },
    {
      accessorKey: "creado_en",
      header: "Fecha",
      cell: ({ row }) => format(new Date(row.original.creado_en), "dd/MM/yyyy HH:mm"),
    },
    {
      id: "cliente",
      header: "Cliente",
      cell: ({ row }) => row.original.clientes?.nombre ?? "—",
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => `Bs ${Number(row.original.total).toFixed(2)}`,
    },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => {
        const e = estadoEfectivo(row.original)
        return (
          <Badge variant="outline" className={cn("font-medium", ESTADO_ESTILO[e])}>
            {ESTADO_ETIQUETA[e]}
          </Badge>
        )
      },
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const e = estadoEfectivo(row.original)
        const esRevisar = e === "pendiente"
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant={esRevisar ? "default" : "ghost"}
              size={esRevisar ? "sm" : "icon"}
              title={esRevisar ? "Revisar precios y convertir" : "Ver detalle / convertir"}
              asChild
            >
              <Link href={`/proformas/${row.original.id}`}>
                <Eye className="size-4" />
                {esRevisar && <span className="ml-1">Revisar precios</span>}
              </Link>
            </Button>
            <a href={`/api/pdf/proforma/${row.original.id}`} target="_blank" rel="noreferrer">
              <Button variant="ghost" size="icon" title="Descargar PDF">
                <Download className="size-4" />
              </Button>
            </a>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
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
          <Select value={estadoFiltro} onValueChange={setEstadoFiltro}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="vigente">Vigente</SelectItem>
              <SelectItem value="pendiente">Pendiente (revisar precios)</SelectItem>
              <SelectItem value="convertida">Convertida</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
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
            {hayFiltroFecha && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFechaDesde("")
                  setFechaHasta("")
                }}
              >
                Limpiar
              </Button>
            )}
          </div>
        </div>

        <Button asChild>
          <Link href="/proformas/nueva">
            <Plus className="size-4" /> Nueva proforma
          </Link>
        </Button>
      </div>

      <TablaDatos columns={columns} data={filtradas} mensajeVacio="Todavía no hay proformas." />
    </div>
  )
}
