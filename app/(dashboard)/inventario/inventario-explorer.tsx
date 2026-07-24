"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { Boxes, Search, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StockBadge } from "@/components/shared/stock-badge"
import { TablaDatos } from "@/components/shared/tabla-datos"
import {
  CriteriosBusqueda,
  CAMPOS_DEFECTO,
  type CampoBusqueda,
} from "@/components/shared/criterios-busqueda"
import type { Rol } from "@/components/shared/nav-items"
import { searchProductosInventario } from "./actions"
import { AjusteStockForm } from "./ajuste-stock-form"

export type ProductoInventario = {
  id: string
  codigo: string
  descripcion: string
  linea_marca: string | null
  stock_actual: number
  stock_minimo: number
  producto_stock_sucursal?: Array<{
    stock_actual: number
    sucursales: { codigo: string; nombre: string } | null
  }>
}

export function InventarioExplorer({
  productos: productosIniciales,
  rol,
}: {
  productos: ProductoInventario[]
  rol: Rol
}) {
  const [productos, setProductos] = useState<ProductoInventario[]>(productosIniciales)
  const [query, setQuery] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [, startTransition] = useTransition()
  const esAdmin = rol === "admin"

  // ref para que refrescar() lea siempre los criterios actuales sin recrearse
  const camposRef = useRef(campos)
  camposRef.current = campos

  const refrescar = useCallback(
    (q: string) => {
      startTransition(async () => {
        if (!q.trim()) {
          setProductos(productosIniciales)
          return
        }
        const resultado = await searchProductosInventario(q, camposRef.current)
        setProductos(resultado as ProductoInventario[])
      })
    },
    [productosIniciales]
  )

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    camposRef.current = next
    if (query.trim()) refrescar(query)
  }

  // debounce atado al evento de escritura (no a un useEffect sobre `query`):
  // asi nunca se dispara solo, ni con la doble invocacion de efectos que hace
  // React en desarrollo. El servidor ya trajo los productos al montar.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function onQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => refrescar(value), 300)
  }

  const columns: ColumnDef<ProductoInventario>[] = [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "descripcion", header: "Descripción" },
    { accessorKey: "linea_marca", header: "Línea / marca" },
    {
      accessorKey: "stock_actual",
      header: "Stock por Sucursal",
      cell: ({ row }) => (
        <StockBadge
          stockActual={row.original.stock_actual}
          stockMinimo={row.original.stock_minimo}
          stockSucursales={row.original.producto_stock_sucursal}
        />
      ),
    },
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
      <CriteriosBusqueda value={campos} onChange={onCamposChange} />
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          placeholder="Escribí para buscar un producto..."
          className="pl-8"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <TablaDatos
        columns={columns}
        data={productos}
        mensajeVacio="No hay productos que coincidan con la búsqueda."
      />
    </div>
  )
}
