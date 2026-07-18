"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Boxes, Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StockBadge } from "@/components/shared/stock-badge"
import { TablaDatos } from "@/components/shared/tabla-datos"
import type { Rol } from "@/components/shared/nav-items"
import { cn } from "@/lib/utils"
import { AjusteStockForm } from "./ajuste-stock-form"

export type DesgloseSucursal = {
  codigo: string
  nombre: string
  stock: number
}

export type ProductoInventario = {
  id: string
  codigo: string
  descripcion: string
  linea_marca: string | null
  stock_actual: number
  stock_minimo: number
  desglose?: DesgloseSucursal[]
}

// Desglose de stock por sucursal (C2 · paso 3b): una etiqueta compacta por
// sucursal, "S{código}: {stock}", en gris cuando la sucursal está en cero.
function DesgloseSucursales({ items }: { items: DesgloseSucursal[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span
          key={s.codigo}
          title={s.nombre}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ring-1 ring-inset",
            s.stock === 0
              ? "bg-muted text-muted-foreground ring-border"
              : "bg-primary/5 text-primary ring-primary/20"
          )}
        >
          <span className="font-semibold">S{s.codigo}</span>
          {s.stock}
        </span>
      ))}
    </div>
  )
}

export function InventarioExplorer({
  productos,
  rol,
  multisucursal = false,
}: {
  productos: ProductoInventario[]
  rol: Rol
  multisucursal?: boolean
}) {
  const [filtro, setFiltro] = useState("")
  const esAdmin = rol === "admin"

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((p) =>
      `${p.codigo} ${p.descripcion} ${p.linea_marca ?? ""}`.toLowerCase().includes(q)
    )
  }, [productos, filtro])

  const columns: ColumnDef<ProductoInventario>[] = [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "descripcion", header: "Descripción" },
    { accessorKey: "linea_marca", header: "Línea / marca" },
    {
      accessorKey: "stock_actual",
      header: multisucursal ? "Stock total" : "Stock",
      cell: ({ row }) => (
        <StockBadge
          stockActual={row.original.stock_actual}
          stockMinimo={row.original.stock_minimo}
        />
      ),
    },
    ...(multisucursal
      ? [
          {
            id: "desglose",
            header: "Por sucursal",
            cell: ({ row }) => (
              <DesgloseSucursales items={row.original.desglose ?? []} />
            ),
          } satisfies ColumnDef<ProductoInventario>,
        ]
      : []),
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Ver Kardex" asChild>
            <Link href={`/kardex?producto=${row.original.id}`}>
              <Boxes className="size-4" />
            </Link>
          </Button>
          {esAdmin && (
            <AjusteStockForm
              productoId={row.original.id}
              productoCodigo={row.original.codigo}
              trigger={
                <Button variant="ghost" size="icon" title="Ajustar stock">
                  <SlidersHorizontal className="size-4" />
                </Button>
              }
            />
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Filtrar por código, descripción o línea..."
          className="pl-8"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>
      <TablaDatos
        columns={columns}
        data={filtrados}
        mensajeVacio="No hay productos que coincidan con el filtro."
      />
    </div>
  )
}
