"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { addDays, format, isBefore } from "date-fns"
import { toast } from "sonner"
import { ArrowRightLeft, Download, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TablaDatos } from "@/components/shared/tabla-datos"
import { ProformaForm } from "./proforma-form"
import { convertirProformaAVenta } from "./actions"

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
  const [fechaDesde, setFechaDesde] = useState("")
  const [fechaHasta, setFechaHasta] = useState("")
  const [convirtiendo, startConvirtiendo] = useTransition()
  const router = useRouter()

  const hayFiltroFecha = fechaDesde !== "" || fechaHasta !== ""

  function onConvertir(p: ProformaFila) {
    startConvirtiendo(async () => {
      const result = await convertirProformaAVenta(p.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Proforma ${p.numero} convertida en venta ${result.numero}.`, {
        action: result.id
          ? {
              label: "Ver comprobante",
              onClick: () => window.open(`/api/pdf/venta/${result.id}`, "_blank"),
            }
          : undefined,
      })
      router.refresh()
    })
  }

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
          <Badge variant={ESTADO_VARIANT[e]} className="capitalize">
            {e}
          </Badge>
        )
      },
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const puedeConvertir = estadoEfectivo(row.original) === "vigente"
        return (
          <div className="flex justify-end gap-1">
            {puedeConvertir && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Convertir a venta" disabled={convirtiendo}>
                    <ArrowRightLeft className="size-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Convertir {row.original.numero} en venta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se registra la venta con estos mismos ítems y descuentos, y se descuenta el
                      stock correspondiente. La proforma queda marcada como convertida y no se
                      puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onConvertir(row.original)}>
                      Convertir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
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
