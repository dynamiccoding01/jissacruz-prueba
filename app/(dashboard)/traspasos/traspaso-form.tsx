"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Search, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { searchProductos } from "@/app/(dashboard)/productos/actions"
import { crearPedidoTraspaso, type TraspasoItemInput } from "./actions"

export type SucursalOption = {
  id: string
  nombre: string
  codigo: string
}

export type ItemForm = {
  producto_id: string
  codigo: string
  descripcion: string
  cantidad: number
}

export function TraspasoForm({
  sucursales,
  userSucursalId,
  esAdmin,
  trigger,
}: {
  sucursales: SucursalOption[]
  userSucursalId?: string
  esAdmin: boolean
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [origenId, setOrigenId] = useState<string>(userSucursalId ?? sucursales[0]?.id ?? "")
  const [destinoId, setDestinoId] = useState<string>(
    sucursales.find((s) => s.id !== (userSucursalId ?? sucursales[0]?.id))?.id ?? ""
  )
  const [notas, setNotas] = useState("")
  const [query, setQuery] = useState("")
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<Array<{ id: string; codigo: string; descripcion: string }>>([])
  const [items, setItems] = useState<ItemForm[]>([])

  const router = useRouter()

  function limpiar() {
    setItems([])
    setNotas("")
    setQuery("")
    setResultados([])
  }

  async function onBuscar(q: string) {
    setQuery(q)
    if (!q.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const res = await searchProductos(q)
    setBuscando(false)
    setResultados(res.map((p: { id: string; codigo: string; descripcion: string }) => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion })))
  }

  function agregarProducto(p: { id: string; codigo: string; descripcion: string }) {
    if (items.some((i) => i.producto_id === p.id)) {
      toast.error("El producto ya está en el pedido.")
      return
    }
    setItems((prev) => [...prev, { producto_id: p.id, codigo: p.codigo, descripcion: p.descripcion, cantidad: 1 }])
    setQuery("")
    setResultados([])
  }

  function quitarItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function cambiarCantidad(idx: number, cant: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, cantidad: Math.max(1, cant) } : item))
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!destinoId) {
      toast.error("Seleccioná la sucursal de destino.")
      return
    }
    if (origenId === destinoId) {
      toast.error("La sucursal de origen y destino no pueden ser iguales.")
      return
    }
    if (items.length === 0) {
      toast.error("Agregá al menos un producto.")
      return
    }

    setLoading(true)
    const payload: TraspasoItemInput[] = items.map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
    }))

    const result = await crearPedidoTraspaso(destinoId, payload, notas, esAdmin ? origenId : undefined)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Pedido de traspaso creado.")
    setOpen(false)
    limpiar()
    router.refresh()
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nuevo Pedido de Traspaso</SheetTitle>
          <SheetDescription>
            Solicitá la transferencia de repuestos entre sucursales.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Sucursal Origen</Label>
              {esAdmin ? (
                <Select value={origenId} onValueChange={setOrigenId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} ({s.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  disabled
                  value={sucursales.find((s) => s.id === userSucursalId)?.nombre ?? "Tu sucursal"}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Sucursal Destino</Label>
              <Select value={destinoId} onValueChange={setDestinoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {sucursales
                    .filter((s) => s.id !== origenId)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nombre} ({s.codigo})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Buscar y agregar producto</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código o descripción..."
                className="pl-8"
                value={query}
                onChange={(e) => onBuscar(e.target.value)}
              />
            </div>
            {buscando && <p className="text-xs text-muted-foreground">Buscando...</p>}
            {resultados.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-sm">
                {resultados.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => agregarProducto(r)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <span>
                      <strong className="mr-2 font-medium">{r.codigo}</strong>
                      <span className="text-muted-foreground">{r.descripcion}</span>
                    </span>
                    <Plus className="size-4 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>Ítems a transferir ({items.length})</Label>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agregaste productos aún.</p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={item.producto_id} className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                    <div className="flex-1 text-sm">
                      <p className="font-medium">{item.codigo}</p>
                      <p className="text-xs text-muted-foreground">{item.descripcion}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="w-16 h-8 text-sm"
                        value={item.cantidad}
                        onChange={(e) => cambiarCantidad(idx, Number(e.target.value))}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => quitarItem(idx)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Notas u observaciones (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Ej: Traspaso urgente para pedido cliente X"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <SheetFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Pedido"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
