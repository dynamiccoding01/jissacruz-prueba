"use client"

import { useCallback, useRef, useState, useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
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
import { TablaDatos } from "@/components/shared/tabla-datos"
import type { Rol } from "@/components/shared/nav-items"
import { deleteCliente, searchClientes } from "./actions"
import { ClienteForm } from "./cliente-form"

export type ClienteFila = {
  id: string
  nombre: string
  ci_nit: string | null
  telefono: string | null
  direccion: string | null
}

export function ClientesExplorer({
  clientesIniciales,
  rol,
}: {
  clientesIniciales: ClienteFila[]
  rol: Rol
}) {
  const [clientes, setClientes] = useState<ClienteFila[]>(clientesIniciales)
  const [query, setQuery] = useState("")
  const [buscando, startTransition] = useTransition()
  const esAdmin = rol === "admin"

  const refrescar = useCallback((q: string) => {
    startTransition(async () => {
      const resultado = await searchClientes(q)
      setClientes(resultado as ClienteFila[])
    })
  }, [])

  // debounce atado al evento de escritura (mismo criterio que productos-explorer)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function onQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => refrescar(value), 300)
  }

  async function onEliminar(id: string) {
    const result = await deleteCliente(id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Cliente eliminado.")
    refrescar(query)
  }

  const columns: ColumnDef<ClienteFila>[] = [
    { accessorKey: "nombre", header: "Nombre" },
    { accessorKey: "ci_nit", header: "CI / NIT" },
    { accessorKey: "telefono", header: "Teléfono" },
    { accessorKey: "direccion", header: "Dirección" },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <ClienteForm
            cliente={row.original}
            onSaved={() => refrescar(query)}
            trigger={
              <Button variant="ghost" size="icon" title="Editar">
                <Pencil className="size-4" />
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
                  <AlertDialogTitle>¿Eliminar {row.original.nombre}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se elimina el cliente de la base. No es posible si ya tiene proformas o
                    ventas registradas.
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
            placeholder="Buscar por nombre, CI/NIT o teléfono..."
            className="pl-8"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </div>
        <ClienteForm
          onSaved={() => refrescar(query)}
          trigger={
            <Button>
              <Plus className="size-4" /> Nuevo cliente
            </Button>
          }
        />
      </div>

      <TablaDatos
        columns={columns}
        data={clientes}
        loading={buscando}
        mensajeVacio="No se encontraron clientes."
      />
    </div>
  )
}
