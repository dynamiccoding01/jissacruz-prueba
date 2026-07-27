"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { ArrowLeftRight, CheckCircle2, PackageCheck, Plus, Search, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { TablaDatos } from "@/components/shared/tabla-datos"
import type { Rol } from "@/components/shared/nav-items"
import { TraspasoForm, type SucursalOption } from "./traspaso-form"
import { cancelarTraspaso, enviarTraspaso, recibirTraspaso, type TraspasoItemInput } from "./actions"

export type TraspasoItem = {
  id: string
  cantidad: number
  cantidad_solicitada: number
  costo_fifo_unitario: number
  producto: { id: string; codigo: string; descripcion: string } | null
}

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
  items: TraspasoItem[]
}

const ESTILOS_ESTADO: Record<TraspasoFila["estado"], string> = {
  pendiente: "bg-amber-100 text-amber-800 border-amber-300",
  enviado: "bg-blue-100 text-blue-800 border-blue-300",
  recibido: "bg-green-100 text-green-800 border-green-300",
  cancelado: "bg-gray-100 text-gray-700 border-gray-300",
}

function DetalleTraspaso({ traspaso, esAdmin }: { traspaso: TraspasoFila; esAdmin: boolean }) {
  const cantTotal = traspaso.items.reduce((acc, i) => acc + i.cantidad_solicitada, 0)
  // el costo FIFO se fija recien al despachar; antes es 0 y no dice nada
  const conCosto = esAdmin && traspaso.estado !== "pendiente" && traspaso.estado !== "cancelado"
  // una vez enviado, tiene sentido mostrar lo despachado vs lo pedido
  const yaEnviado = traspaso.estado === "enviado" || traspaso.estado === "recibido"

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-left text-sm underline-offset-2 hover:underline"
          title="Ver productos del pedido"
        >
          {traspaso.items.length} prod. ({cantTotal} un.)
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedido {traspaso.numero}</DialogTitle>
          <DialogDescription>
            {traspaso.sucursal_destino?.nombre ?? "Destino"} le pide a{" "}
            {traspaso.sucursal_origen?.nombre ?? "Origen"}
            {traspaso.notas ? ` · ${traspaso.notas}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2 text-right">Pedido</th>
                {yaEnviado && <th className="px-3 py-2 text-right">Enviado</th>}
                {conCosto && <th className="px-3 py-2 text-right">Costo FIFO</th>}
              </tr>
            </thead>
            <tbody>
              {traspaso.items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{it.producto?.codigo ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{it.producto?.descripcion ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{it.cantidad_solicitada}</td>
                  {yaEnviado && (
                    <td className="px-3 py-2 text-right font-medium">
                      {it.cantidad}
                      {it.cantidad !== it.cantidad_solicitada && (
                        <span className="ml-1 text-xs text-amber-700">(ajustado)</span>
                      )}
                    </td>
                  )}
                  {conCosto && (
                    <td className="px-3 py-2 text-right">Bs {Number(it.costo_fifo_unitario).toFixed(2)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Diálogo de despacho: el origen ajusta las cantidades (0 = no enviar ese ítem)
// y despacha en un solo paso.
function DespacharDialog({
  traspaso,
  disabled,
  onConfirmar,
}: {
  traspaso: TraspasoFila
  disabled: boolean
  onConfirmar: (cantidades: TraspasoItemInput[]) => void
}) {
  const [open, setOpen] = useState(false)
  const productoIdDe = (it: TraspasoItem) => it.producto?.id ?? it.id

  const [cant, setCant] = useState<Record<string, number>>(() =>
    Object.fromEntries(traspaso.items.map((i) => [productoIdDe(i), i.cantidad_solicitada]))
  )

  function confirmar() {
    const cantidades: TraspasoItemInput[] = traspaso.items.map((it) => ({
      producto_id: productoIdDe(it),
      cantidad: Math.max(0, Number(cant[productoIdDe(it)] ?? 0)),
    }))
    setOpen(false)
    onConfirmar(cantidades)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
          disabled={disabled}
        >
          <PackageCheck className="size-3.5" /> Despachar
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Despachar {traspaso.numero}</DialogTitle>
          <DialogDescription>
            Ajustá cuánto vas a enviar de cada ítem. Poné 0 para no despachar uno. Se descuenta el
            stock de {traspaso.sucursal_origen?.nombre ?? "origen"} por FIFO.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {traspaso.items.map((it) => {
            const pid = productoIdDe(it)
            return (
              <div key={it.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{it.producto?.codigo ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">Pedido: {it.cantidad_solicitada}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Enviar</Label>
                  <Input
                    type="number"
                    min={0}
                    className="h-9 w-20"
                    value={cant[pid] ?? 0}
                    onChange={(e) => setCant((prev) => ({ ...prev, [pid]: Number(e.target.value) }))}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmar}>Despachar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
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

  function handleEnviar(id: string, numero: string, cantidades: TraspasoItemInput[]) {
    startTransition(async () => {
      const res = await enviarTraspaso(id, cantidades)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`Pedido ${numero} despachado (salida FIFO registrada).`)
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
      toast.success(`Pedido ${numero} recibido (entrada de lote FIFO registrada).`)
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
      toast.success(`Pedido ${numero} cancelado.`)
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
      header: "Pide → Le pide a",
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span className="rounded bg-muted px-1.5 py-0.5">{row.original.sucursal_destino?.codigo ?? "Destino"}</span>
          <ArrowLeftRight className="size-3 text-muted-foreground" />
          <span className="rounded bg-muted px-1.5 py-0.5">{row.original.sucursal_origen?.codigo ?? "Origen"}</span>
        </span>
      ),
    },
    {
      id: "items_count",
      header: "Ítems",
      cell: ({ row }) => <DetalleTraspaso traspaso={row.original} esAdmin={esAdmin} />,
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
              <DespacharDialog
                traspaso={t}
                disabled={isPending}
                onConfirmar={(cantidades) => handleEnviar(t.id, t.numero, cantidades)}
              />
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

            {t.estado === "pendiente" && esDestino && (
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
              <Plus className="size-4" /> Nuevo Pedido
            </Button>
          }
        />
      </div>

      <TablaDatos
        columns={columns}
        data={filtrados}
        loading={isPending}
        mensajeVacio="No se encontraron pedidos."
      />
    </div>
  )
}
