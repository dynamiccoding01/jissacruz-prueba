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
import { deleteProveedor } from "./actions"
import { ProveedorForm } from "./proveedor-form"

export type ProveedorFila = {
  id: string
  nombre: string
  contacto: string | null
  nit: string | null
  direccion: string | null
}

export function ProveedoresExplorer({ proveedores }: { proveedores: ProveedorFila[] }) {
  const router = useRouter()

  async function onEliminar(id: string) {
    const result = await deleteProveedor(id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Proveedor eliminado.")
    router.refresh()
  }

  const columns: ColumnDef<ProveedorFila>[] = [
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "contacto", header: "Contacto" },
    { accessorKey: "nit", header: "NIT" },
    { accessorKey: "direccion", header: "Dirección" },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ProveedorForm
            proveedor={row.original}
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
                  Deja de aparecer en la lista de proveedores. No afecta el historial de compras
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
        <ProveedorForm
          trigger={
            <Button>
              <Plus className="size-4" /> Nuevo proveedor
            </Button>
          }
        />
      </div>
      <TablaDatos
        columns={columns}
        data={proveedores}
        mensajeVacio="Aún no hay proveedores registrados."
      />
    </div>
  )
}
