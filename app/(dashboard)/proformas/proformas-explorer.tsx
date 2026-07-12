"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { addDays, format, isBefore } from "date-fns"
import { Download, Plus } from "lucide-react"

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
import { ProformaForm } from "./proforma-form"

export type ProformaFila = {
  id: string
  numero: string
  creado_en: string
  plazo_validez_dias: number
  total: number
  estado: "vigente" | "convertida" | "vencida"
  clientes: { id: string; nombre: string } | null
}

type EstadoEfectivo = "vigente" | "convertida" | "vencida"

const ESTADO_VARIANT: Record<EstadoEfectivo, "default" | "secondary" | "destructive"> = {
  vigente: "secondary",
  convertida: "default",
  vencida: "destructive",
}

// 'vencida' se deriva de la fecha (misma regla que la vista vista_proformas)
function estadoEfectivo(p: ProformaFila): EstadoEfectivo {
  if (p.estado === "vigente" && isBefore(addDays(new Date(p.creado_en), p.plazo_validez_dias), new Date())) {
    return "vencida"
  }
  return p.estado
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

  const filtradas = useMemo(
    () =>
      proformas.filter((p) => {
        if (clienteFiltro !== "todos" && p.clientes?.id !== clienteFiltro) return false
        if (estadoFiltro !== "todos" && estadoEfectivo(p) !== estadoFiltro) return false
        return true
      }),
    [proformas, clienteFiltro, estadoFiltro]
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
          <Badge variant={ESTADO_VARIANT[e]} className="capitalize">
            {e}
          </Badge>
        )
      },
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <a href={`/api/pdf/proforma/${row.original.id}`} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon" title="Descargar PDF">
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
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filtrar por estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="vigente">Vigente</SelectItem>
              <SelectItem value="convertida">Convertida</SelectItem>
              <SelectItem value="vencida">Vencida</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ProformaForm
          clientes={clientes}
          trigger={
            <Button>
              <Plus className="size-4" /> Nueva proforma
            </Button>
          }
        />
      </div>

      <TablaDatos
        columns={columns}
        data={filtradas}
        mensajeVacio="Todavía no hay proformas."
      />
    </div>
  )
}
