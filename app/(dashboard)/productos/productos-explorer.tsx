"use client"

import { useCallback, useRef, useState, useTransition } from "react"
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
import {
  CriteriosBusqueda,
  CAMPOS_DEFECTO,
  type CampoBusqueda,
} from "@/components/shared/criterios-busqueda"
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
  producto_stock_sucursal?: Array<{
    stock_actual: number
    sucursales: { codigo: string; nombre: string } | null
  }>
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
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [buscando, startTransition] = useTransition()
  const esAdmin = rol === "admin"

  // ref para que refrescar() lea siempre los criterios actuales sin recrearse
  const camposRef = useRef(campos)
  camposRef.current = campos

  const refrescar = useCallback((q: string) => {
    startTransition(async () => {
      const resultado = await searchProductos(q, camposRef.current)
      setProductos(resultado as ProductoFila[])
    })
  }, [])

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    camposRef.current = next
    if (query.trim()) refrescar(query)
  }

  // debounce atado al evento de escritura (no a un useEffect sobre `query`):
  // asi nunca se dispara solo, ni con la doble invocacion de efectos que hace
  // React en desarrollo. El servidor ya trajo productosIniciales al montar.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function onQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => refrescar(value), 300)
  }

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
      <div className="space-y-3">
        <CriteriosBusqueda value={campos} onChange={onCamposChange} />
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Escribí para buscar un producto..."
              className="pl-8"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
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
      </div>

      <TablaDatos
        columns={columns}
        data={productos}
        loading={buscando}
        mensajeVacio="No se encontraron productos con ese criterio."
      />
    </div>
  )
}
