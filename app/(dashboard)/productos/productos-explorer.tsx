"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { StockBadge } from "@/components/shared/stock-badge"
import { TablaDatos } from "@/components/shared/tabla-datos"
import type { Rol } from "@/components/shared/nav-items"
import { deleteProducto, searchProductos } from "./actions"
import { ProductoForm } from "./producto-form"

export type ProductoFila = {
  id: string
  codigo: string
  descripcion: string
  linea_marca: string | null
  precio: number
  stock_actual: number
  stock_minimo: number
  imagen_url: string | null
}

export function ProductosExplorer({
  productosIniciales,
  rol,
}: {
  productosIniciales: ProductoFila[]
  rol: Rol
}) {
  const [productos, setProductos] = useState<ProductoFila[]>(productosIniciales)
  const [query, setQuery] = useState("")
  const [buscando, startTransition] = useTransition()
  const esAdmin = rol === "admin"

  const refrescar = useCallback((q: string) => {
    startTransition(async () => {
      const resultado = await searchProductos(q)
      setProductos(resultado as ProductoFila[])
    })
  }, [])

  // el servidor ya trajo productosIniciales: no repetir esa misma busqueda
  // apenas monta, solo cuando el usuario efectivamente escribe algo
  const primerRender = useRef(true)
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    const id = setTimeout(() => refrescar(query), 300)
    return () => clearTimeout(id)
  }, [query, refrescar])

  async function onEliminar(id: string) {
    const result = await deleteProducto(id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Producto eliminado.")
    refrescar(query)
  }

  const columns: ColumnDef<ProductoFila>[] = [
    {
      accessorKey: "imagen_url",
      header: "",
      cell: ({ row }) =>
        row.original.imagen_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.original.imagen_url}
            alt=""
            className="h-10 w-10 rounded object-cover"
          />
        ) : (
          <div className="h-10 w-10 rounded bg-muted" />
        ),
    },
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "descripcion", header: "Descripción" },
    { accessorKey: "linea_marca", header: "Línea / marca" },
    {
      accessorKey: "precio",
      header: "Precio",
      cell: ({ row }) => `Bs ${Number(row.original.precio).toFixed(2)}`,
    },
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
        <div className="flex justify-end gap-1">
          <ProductoForm
            productoId={row.original.id}
            readOnly={!esAdmin}
            onSaved={() => refrescar(query)}
            trigger={
              <Button variant="ghost" size="icon" title={esAdmin ? "Editar" : "Ver"}>
                {esAdmin ? <Pencil className="size-4" /> : <Eye className="size-4" />}
              </Button>
            }
          />
          {esAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" title="Eliminar">
                  <Trash2 className="size-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar {row.original.codigo}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    El producto deja de aparecer en el catálogo y las búsquedas. No se borra el
                    historial de Kardex asociado.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onEliminar(row.original.id)}>
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descripción, equivalente o vehículo..."
            className="pl-8"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {esAdmin && (
          <ProductoForm
            onSaved={() => refrescar(query)}
            trigger={
              <Button>
                <Plus className="size-4" /> Nuevo producto
              </Button>
            }
          />
        )}
      </div>

      {buscando ? (
        <p className="text-sm text-muted-foreground">Buscando...</p>
      ) : (
        <TablaDatos columns={columns} data={productos} />
      )}
    </div>
  )
}
