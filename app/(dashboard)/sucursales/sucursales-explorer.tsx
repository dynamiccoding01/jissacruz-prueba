"use client"

import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import { TablaDatos } from "@/components/shared/tabla-datos"
import { deleteSucursal } from "./actions"
import { SucursalForm } from "./sucursal-form"

export type SucursalFila = {
  id: string
  codigo: string
  nombre: string
  direccion: string | null
  telefono: string | null
}

export function SucursalesExplorer({ sucursales }: { sucursales: SucursalFila[] }) {
  const router = useRouter()

  async function onEliminar(id: string) {
    const result = await deleteSucursal(id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Sucursal eliminada.")
    router.refresh()
  }

  const columns: ColumnDef<SucursalFila>[] = [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "direccion", header: "Dirección" },
    { accessorKey: "telefono", header: "Teléfono" },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <SucursalForm
            sucursal={row.original}
            trigger={
              <Button variant="ghost" size="icon" title="Editar">
                <Pencil className="size-4" />
              </Button>
            }
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Eliminar">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar {row.original.nombre}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deja de aparecer en la lista de sucursales. No afecta el stock ni el historial
                  ya registrado.
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
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <SucursalForm
          trigger={
            <Button>
              <Plus className="size-4" /> Nueva sucursal
            </Button>
          }
        />
      </div>
      <TablaDatos
        columns={columns}
        data={sucursales}
        mensajeVacio="Aún no hay sucursales registradas."
      />
    </div>
  )
}
