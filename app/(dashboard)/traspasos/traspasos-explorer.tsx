"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeftRight, CheckCircle2, PackageCheck, Plus, Search, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { TablaDatos } from "@/components/shared/tabla-datos"
import type { Rol } from "@/components/shared/nav-items"
import { TraspasoForm, type SucursalOption } from "./traspaso-form"
import { cancelarTraspaso, enviarTraspaso, recibirTraspaso } from "./actions"

export type TraspasoFila = {
  id: string
  numero: string
  estado: "pendiente" | "enviado" | "recibido" | "cancelado"
  creado_en: string
  fecha_envio: string | null
  fecha_recepcion: string | null
  notas: string | null
  sucursal_origen: { id: string; codigo: string; nombre: string } | null
  sucursal_destino: { id: string; codigo: string; nombre: string } | null
  items: Array<{
    id: string
    cantidad: number
    costo_fifo_unitario: number
    producto: { id: string; codigo: string; descripcion: string } | null
  }>
}

const ESTILOS_ESTADO: Record<TraspasoFila["estado"], string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  enviado: "bg-blue-100 text-blue-800 border-blue-300",
  recibido: "bg-green-100 text-green-800 border-green-300",
  cancelado: "bg-gray-100 text-gray-700 border-gray-300",
}

export function TraspasosExplorer({
  traspasos,
  sucursales,
  userSucursalId,
  rol,
}: {
  traspasos: TraspasoFila[]
  sucursales: SucursalOption[]
  userSucursalId?: string
  rol: Rol
}) {
  const [filtro, setFiltro] = useState("")
  const [isPending, startTransition] = useTransition()
  const esAdmin = rol === "admin"
  const router = useRouter()

  const filtrados = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return traspasos
    return traspasos.filter(
      (t) =>
        t.numero.toLowerCase().includes(q) ||
        (t.sucursal_origen?.nombre ?? "").toLowerCase().includes(q) ||
        (t.sucursal_destino?.nombre ?? "").toLowerCase().includes(q) ||
        (t.notas ?? "").toLowerCase().includes(q)
    )
  }, [traspasos, filtro])

  function handleEnviar(id: string, numero: string) {
    startTransition(async () => {
      const res = await enviarTraspaso(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Traspaso ${numero} despachado (salida FIFO registrada).`)
      router.refresh()
    })
  }

  function handleRecibir(id: string, numero: string) {
    startTransition(async () => {
      const res = await recibirTraspaso(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Traspaso ${numero} recibido (entrada de lote FIFO registrada).`)
      router.refresh()
    })
  }

  function handleCancelar(id: string, numero: string) {
    startTransition(async () => {
      const res = await cancelarTraspaso(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Traspaso ${numero} cancelado.`)
      router.refresh()
    })
  }

  const columns: ColumnDef<TraspasoFila>[] = [
    {
      accessorKey: "numero",
      header: "N° Pedido",
      cell: ({ row }) => <span className="font-semibold">{row.original.numero}</span>,
    },
    {
      accessorKey: "creado_en",
      header: "Fecha",
      cell: ({ row }) => new Date(row.original.creado_en).toLocaleDateString("es-BO"),
    },
    {
      id: "ruta",
      header: "Origen → Destino",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className="rounded bg-muted px-1.5 py-0.5">{row.original.sucursal_origen?.codigo ?? "Origen"}</span>
          <ArrowLeftRight className="size-3 text-muted-foreground" />
          <span className="rounded bg-muted px-1.5 py-0.5">{row.original.sucursal_destino?.codigo ?? "Destino"}</span>
        </span>
      ),
    },
    {
      id: "items_count",
      header: "Ítems",
      cell: ({ row }) => {
        const cantTotal = row.original.items.reduce((acc, i) => acc + i.cantidad, 0)
        return `${row.original.items.length} prod. (${cantTotal} un.)`
      },
    },
    {
      accessorKey: "estado",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant="outline" className={ESTILOS_ESTADO[row.original.estado]}>
          {row.original.estado.toUpperCase()}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "",
      cell: ({ row }) => {
        const t = row.original
        const esOrigen = esAdmin || t.sucursal_origen?.id === userSucursalId
        const esDestino = esAdmin || t.sucursal_destino?.id === userSucursalId

        return (
          <div className="flex justify-end gap-1">
            {t.estado === "pendiente" && esOrigen && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                disabled={isPending}
                onClick={() => handleEnviar(t.id, t.numero)}
              >
                <PackageCheck className="size-3.5" /> Despachar
              </Button>
            )}

            {t.estado === "enviado" && esDestino && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-green-300 text-green-700 hover:bg-green-50"
                disabled={isPending}
                onClick={() => handleRecibir(t.id, t.numero)}
              >
                <CheckCircle2 className="size-3.5" /> Recibir
              </Button>
            )}

            {t.estado === "pendiente" && esOrigen && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={() => handleCancelar(t.id, t.numero)}
                title="Cancelar pedido"
              >
                <XCircle className="size-4" />
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por N° pedido, sucursal o notas..."
            className="pl-8"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          />
        </div>

        <TraspasoForm
          sucursales={sucursales}
          userSucursalId={userSucursalId}
          esAdmin={esAdmin}
          trigger={
            <Button>
              <Plus className="size-4" /> Solicitud de Traspaso
            </Button>
          }
        />
      </div>

      <TablaDatos
        columns={columns}
        data={filtrados}
        loading={isPending}
        mensajeVacio="No se encontraron pedidos de traspaso."
      />
    </div>
  )
}
