"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { Eye, Plus } from "lucide-react"

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
import { OrdenCompraForm } from "./orden-compra-form"
import { OrdenDetalle } from "./orden-detalle"

export type OrdenItemFila = {
  cantidad: number
  costo_unitario: number
  productos: { codigo: string; descripcion: string } | null
}

export type OrdenFila = {
  id: string
  estado: "pendiente" | "recibida" | "cancelada"
  fecha_orden: string
  fecha_recepcion: string | null
  notas: string | null
  proveedores: { id: string; nombre: string } | null
  orden_compra_items: OrdenItemFila[]
}

const ESTADO_VARIANT: Record<OrdenFila["estado"], "default" | "secondary" | "destructive"> = {
  pendiente: "secondary",
  recibida: "default",
  cancelada: "destructive",
}

export function ComprasExplorer({
  ordenes,
  proveedores,
}: {
  ordenes: OrdenFila[]
  proveedores: { id: string; nombre: string }[]
}) {
  const [proveedorFiltro, setProveedorFiltro] = useState<string>("todos")

  const filtradas = useMemo(() => {
    if (proveedorFiltro === "todos") return ordenes
    return ordenes.filter((o) => o.proveedores?.id === proveedorFiltro)
  }, [ordenes, proveedorFiltro])

  const columns: ColumnDef<OrdenFila>[] = [
    {
      accessorKey: "fecha_orden",
      header: "Fecha",
      cell: ({ row }) => format(new Date(row.original.fecha_orden), "dd/MM/yyyy HH:mm"),
    },
    {
      id: "proveedor",
      header: "Proveedor",
      cell: ({ row }) => row.original.proveedores?.nombre ?? "—",
    },
    {
      id: "items",
      header: "Ítems",
      cell: ({ row }) => row.original.orden_compra_items.length,
    },
    {
      id: "total",
      header: "Total",
      cell: ({ row }) =>
        `Bs ${row.original.orden_compra_items
          .reduce((acc, i) => acc + i.cantidad * i.costo_unitario, 0)
          .toFixed(2)}`,
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={ESTADO_VARIANT[row.original.estado]} className="capitalize">
          {row.original.estado}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <OrdenDetalle
            orden={row.original}
            trigger={
              <Button variant="ghost" size="icon" title="Ver detalle">
                <Eye className="size-4" />
              </Button>
            }
          />
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={proveedorFiltro} onValueChange={setProveedorFiltro}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Filtrar por proveedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los proveedores</SelectItem>
            {proveedores.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <OrdenCompraForm
          proveedores={proveedores}
          trigger={
            <Button>
              <Plus className="size-4" /> Nueva orden de compra
            </Button>
          }
        />
      </div>

      <TablaDatos columns={columns} data={filtradas} />
    </div>
  )
}
