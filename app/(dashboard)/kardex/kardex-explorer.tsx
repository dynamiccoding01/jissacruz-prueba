"use client"

import { useRef, useState, useTransition } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { History, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StockBadge } from "@/components/shared/stock-badge"
import { TablaDatos } from "@/components/shared/tabla-datos"
import {
  CriteriosBusqueda,
  CAMPOS_DEFECTO,
  type CampoBusqueda,
} from "@/components/shared/criterios-busqueda"
import { buscarProductosParaKardex, type ProductoKardex } from "./actions"

// PLAN_7 · T3: entrada propia del Kardex. Se busca un producto y se abre su
// kardex (`/kardex?producto=…`); ya no hace falta pasar por Inventario.
export function KardexExplorer() {
  const [productos, setProductos] = useState<ProductoKardex[]>([])
  const [query, setQuery] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [, startTransition] = useTransition()

  // ref para que buscar() lea siempre los criterios actuales
  const camposRef = useRef(campos)
  camposRef.current = campos

  function buscar(q: string) {
    startTransition(async () => {
      if (!q.trim()) {
        setProductos([])
        return
      }
      setProductos(await buscarProductosParaKardex(q, camposRef.current))
    })
  }

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    camposRef.current = next
    if (query.trim()) buscar(query)
  }

  // debounce atado al evento de escritura (no a un useEffect sobre `query`)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function onQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => buscar(value), 300)
  }

  const columns: ColumnDef<ProductoKardex>[] = [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "descripcion", header: "Descripción" },
    { accessorKey: "linea_marca", header: "Línea / marca" },
    {
      accessorKey: "stock_actual",
      header: "Stock",
      cell: ({ row }) => (
        <StockBadge
          stockActual={row.original.stock_actual}
          stockMinimo={row.original.stock_minimo}
        />
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-1" asChild>
            <Link href={`/kardex?producto=${row.original.id}`}>
              <History className="size-4" /> Ver kardex
            </Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Buscá un producto para ver todos sus movimientos de stock.
      </p>
      <CriteriosBusqueda value={campos} onChange={onCamposChange} />
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Escribí para buscar un producto..."
          className="pl-8"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <TablaDatos
        columns={columns}
        data={productos}
        mensajeVacio={
          query.trim()
            ? "No hay productos que coincidan con la búsqueda."
            : "Todavía no buscaste ningún producto."
        }
      />
    </div>
  )
}
