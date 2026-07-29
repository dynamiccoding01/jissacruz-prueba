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
import { deleteUnidad } from "./actions"
import { UnidadForm } from "./unidad-form"

export type UnidadFila = {
  id: string
  codigo: string
  nombre: string
  abreviatura: string | null
}

export function UnidadesExplorer({ unidades }: { unidades: UnidadFila[] }) {
  const router = useRouter()

  async function onEliminar(id: string) {
    const result = await deleteUnidad(id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Unidad desactivada.")
    router.refresh()
  }

  const columns: ColumnDef<UnidadFila>[] = [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "nombre", header: "Nombre" },
    {
      accessorKey: "abreviatura",
      header: "Abreviatura",
      cell: ({ row }) => row.original.abreviatura ?? "—",
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <UnidadForm
            unidad={row.original}
            trigger={
              <Button variant="ghost" size="icon" title="Editar">
                <Pencil className="size-4" />
              </Button>
            }
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" title="Desactivar">
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Desactivar {row.original.nombre}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deja de aparecer para elegir en productos nuevos. Los productos que ya la usan no
                  se ven afectados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onEliminar(row.original.id)}>
                  Desactivar
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
        <UnidadForm
          trigger={
            <Button>
              <Plus className="size-4" /> Nueva unidad
            </Button>
          }
        />
      </div>
      <TablaDatos
        columns={columns}
        data={unidades}
        mensajeVacio="Aún no hay unidades. Agregá las que usa el negocio (Pieza, Docena, Juego…)."
      />
    </div>
  )
}
