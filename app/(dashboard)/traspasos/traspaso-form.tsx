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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  CriteriosBusqueda,
  CAMPOS_DEFECTO,
  type CampoBusqueda,
} from "@/components/shared/criterios-busqueda"
import { formatearMedidas } from "@/lib/medidas"
import {
  buscarProductosParaPedido,
  crearPedidoTraspaso,
  type ProductoBusquedaPedido,
  type TraspasoItemInput,
} from "./actions"

export type SucursalOption = {
  id: string
  nombre: string
  codigo: string
}

export type ItemForm = {
  producto_id: string
  codigo: string
  descripcion: string
  unidad: string
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
  // El creador es el DESTINO (solicitante): por defecto su propia sucursal.
  const [destinoId, setDestinoId] = useState<string>(userSucursalId ?? sucursales[0]?.id ?? "")
  // Origen = la sucursal a la que le pide el producto (otra).
  const [origenId, setOrigenId] = useState<string>(
    sucursales.find((s) => s.id !== (userSucursalId ?? sucursales[0]?.id))?.id ?? ""
  )
  const [notas, setNotas] = useState("")
  const [query, setQuery] = useState("")
  const [campos, setCampos] = useState<CampoBusqueda[]>(CAMPOS_DEFECTO)
  const [buscando, setBuscando] = useState(false)
  const [resultados, setResultados] = useState<ProductoBusquedaPedido[]>([])
  const [items, setItems] = useState<ItemForm[]>([])

  const router = useRouter()

  const totalUnidades = items.reduce((acc, i) => acc + Number(i.cantidad || 0), 0)

  function limpiar() {
    setItems([])
    setNotas("")
    setQuery("")
    setResultados([])
  }

  async function onBuscar(q: string, camposBusqueda: CampoBusqueda[] = campos) {
    setQuery(q)
    if (!q.trim()) {
      setResultados([])
      return
    }
    setBuscando(true)
    const res = await buscarProductosParaPedido(q, camposBusqueda)
    setBuscando(false)
    setResultados(res)
  }

  function onCamposChange(next: CampoBusqueda[]) {
    setCampos(next)
    if (query.trim()) onBuscar(query, next)
  }

  function agregarProducto(p: ProductoBusquedaPedido) {
    if (items.some((i) => i.producto_id === p.id)) {
      toast.error("El producto ya está en el pedido.")
      return
    }
    setItems((prev) => [
      ...prev,
      {
        producto_id: p.id,
        codigo: p.codigo,
        descripcion: p.descripcion,
        unidad: p.unidad,
        cantidad: 1,
      },
    ])
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
    if (!origenId) {
      toast.error("Elegí la sucursal a la que le pedís (origen).")
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

    // origen = a quién le pido; destino = mi sucursal (admin puede elegirlo)
    const result = await crearPedidoTraspaso(origenId, payload, notas, esAdmin ? destinoId : undefined)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Pedido creado.")
    setOpen(false)
    limpiar()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) limpiar()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[92vh] w-[95vw] max-w-6xl overflow-hidden p-0 sm:rounded-2xl">
        <form onSubmit={onSubmit} className="flex max-h-[92vh] flex-col">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle className="text-xl">Nuevo Pedido</DialogTitle>
            <DialogDescription>
              Pedí repuestos a otra sucursal. Vos sos el destino; el origen los despacha.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {/* Sucursales */}
            <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mi sucursal (destino)</Label>
                {esAdmin ? (
                  <Select value={destinoId} onValueChange={setDestinoId}>
                    <SelectTrigger className="h-11">
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
                    className="h-11"
                    value={sucursales.find((s) => s.id === userSucursalId)?.nombre ?? "Tu sucursal"}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Le pido a (origen)</Label>
                <Select value={origenId} onValueChange={setOrigenId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sucursales
                      .filter((s) => s.id !== destinoId)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nombre} ({s.codigo})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Buscar productos */}
            <div className="space-y-2">
              <Label className="text-base">Agregar productos</Label>
              <CriteriosBusqueda value={campos} onChange={onCamposChange} />
              <div className="relative">
                <Search className="absolute left-3 top-3 size-5 text-muted-foreground" />
                <Input
                  className="h-12 pl-10 text-base"
                  placeholder="Escribí para buscar un producto..."
                  value={query}
                  onChange={(e) => onBuscar(e.target.value)}
                  onKeyDown={(e) => {
                    // F3: Enter agrega el primer resultado. preventDefault ademas
                    // evita que el Enter dispare el submit del <form> del modal.
                    if (e.key === "Enter") {
                      e.preventDefault()
                      if (buscando || resultados.length === 0) return
                      agregarProducto(resultados[0])
                    }
                  }}
                />
              </div>
              {buscando && <p className="text-sm text-muted-foreground">Buscando...</p>}
              {resultados.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                  {resultados.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => agregarProducto(r)}
                      className="flex w-full items-start justify-between gap-2 border-b border-border px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block">
                          <span className="text-base font-semibold">{r.codigo}</span>{" "}
                          <span className="text-muted-foreground">— {r.descripcion}</span>
                        </span>
                        {r.medidas.length > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            Medidas: {formatearMedidas(r.medidas)}
                          </span>
                        )}
                        {r.originales.length > 0 && (
                          <span className="block text-xs text-muted-foreground">
                            OEM: {r.originales.slice(0, 4).join(", ")}
                            {r.originales.length > 4 ? "…" : ""}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                        {r.unidad}
                        <Plus className="size-5 text-primary" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Ítems */}
            <div className="space-y-3">
              <Label className="text-base">Ítems a pedir ({items.length})</Label>
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                  No agregaste productos aún.
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 text-left">Producto</th>
                        <th className="w-24 px-3 py-2 text-left">Unidad</th>
                        <th className="w-32 px-3 py-2 text-right">Cantidad</th>
                        <th className="w-12 px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={item.producto_id} className="border-t border-border">
                          <td className="px-4 py-2">
                            <p className="font-medium">{item.codigo}</p>
                            <p className="text-xs text-muted-foreground">{item.descripcion}</p>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">{item.unidad}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min={1}
                              className="h-10 text-right"
                              value={item.cantidad}
                              onChange={(e) => cambiarCantidad(idx, Number(e.target.value))}
                            />
                          </td>
                          <td className="px-2 py-2 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => quitarItem(idx)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Notas u observaciones (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Ej: Pedido urgente para cliente X"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
            <div className="text-sm text-muted-foreground">
              {items.length} producto{items.length === 1 ? "" : "s"} ·{" "}
              <span className="text-lg font-semibold text-foreground">{totalUnidades}</span> unidades
            </div>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? "Creando..." : "Crear Pedido"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
