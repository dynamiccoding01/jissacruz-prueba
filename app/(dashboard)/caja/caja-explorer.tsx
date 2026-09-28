"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Trash2, User } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TIPOS_PAGO } from "@/lib/tipos-pago"
import { confirmarVentaPendiente, cancelarVentaPendiente } from "./actions"

type ItemPendiente = {
  cantidad: number
  precio_unitario: number
  subtotal_linea: number
  productos: { codigo: string; descripcion: string; con_factura: boolean } | null
}

export type PendienteFila = {
  id: string
  numero: string
  creado_en: string
  total: number
  clientes: { id: string; nombre: string } | null
  creador: { nombre_completo: string } | null
  venta_pendiente_items: ItemPendiente[]
}

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

// T4 (PLAN_6): un pedido con productos S/F se cobra SIEMPRE sin factura
// (un producto S/F no se puede facturar; la BD también lo exige).
const esPedidoSF = (p: PendienteFila) =>
  p.venta_pendiente_items.some((it) => it.productos?.con_factura === false)

export function CajaExplorer({ pendientes }: { pendientes: PendienteFila[] }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState<PendienteFila | null>(null)
  const [tipoPago, setTipoPago] = useState("")
  const [conFactura, setConFactura] = useState(true)
  const [loading, setLoading] = useState(false)
  const [cancelandoId, setCancelandoId] = useState<string | null>(null)

  function abrirConfirmar(p: PendienteFila) {
    setConfirmando(p)
    setTipoPago("")
    setConFactura(!esPedidoSF(p))
  }

  const confirmandoSF = confirmando ? esPedidoSF(confirmando) : false

  async function onConfirmar() {
    if (!confirmando) return
    setLoading(true)
    // Se abre la pestaña del PDF dentro del gesto del click (antes del await) para
    // que el bloqueador de popups no la corte.
    const ventana = window.open("about:blank", "_blank")
    const result = await confirmarVentaPendiente(confirmando.id, tipoPago, conFactura)
    setLoading(false)
    if (result.error) {
      ventana?.close()
      toast.error(result.error)
      return
    }
    if (result.id) {
      const url = `/api/pdf/venta/${result.id}`
      if (ventana) ventana.location.href = url
      else window.open(url, "_blank")
    } else {
      ventana?.close()
    }
    toast.success(`Venta ${result.numero} cobrada.`)
    setConfirmando(null)
    router.refresh()
  }

  async function onCancelar(p: PendienteFila) {
    if (!window.confirm(`¿Cancelar el pedido ${p.numero}? No se puede deshacer.`)) return
    setCancelandoId(p.id)
    const result = await cancelarVentaPendiente(p.id)
    setCancelandoId(null)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(`Pedido ${p.numero} cancelado.`)
    router.refresh()
  }

  if (pendientes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center text-muted-foreground">
        No hay pedidos pendientes de cobro.
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {pendientes.map((p) => (
          <div key={p.id} className="flex flex-col rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-2 text-base font-semibold">
                  {p.numero}
                  {esPedidoSF(p) && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                      S/F
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(p.creado_en), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p className="flex items-center justify-end gap-1">
                  <User className="size-3" /> {p.creador?.nombre_completo ?? "—"}
                </p>
                <p>Cliente: {p.clientes?.nombre ?? "SIN NOMBRE"}</p>
              </div>
            </div>

            <div className="mt-3 divide-y divide-border rounded-md border border-border">
              {p.venta_pendiente_items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{it.productos?.codigo ?? "—"}</span>{" "}
                    <span className="text-muted-foreground">{it.productos?.descripcion ?? ""}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {it.cantidad} × {bs(it.precio_unitario)}
                  </span>
                  <span className="w-24 shrink-0 text-right font-medium">{bs(it.subtotal_linea)}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-primary tabular-nums">{bs(p.total)}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => onCancelar(p)}
                disabled={cancelandoId === p.id}
              >
                <Trash2 className="size-4" /> {cancelandoId === p.id ? "Cancelando…" : "Cancelar"}
              </Button>
              <Button className="flex-1" onClick={() => abrirConfirmar(p)}>
                <CheckCircle2 className="size-4" /> Confirmar / Cobrar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={confirmando !== null} onOpenChange={(o) => !o && setConfirmando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cobrar {confirmando?.numero}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-primary px-4 py-3 text-primary-foreground">
              <span className="text-sm font-semibold uppercase tracking-wide">Total</span>
              <span className="text-2xl font-bold tabular-nums">{bs(confirmando?.total ?? 0)}</span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Tipo de pago</Label>
              <Select value={tipoPago} onValueChange={setTipoPago}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Seleccionar…" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_PAGO.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Factura</Label>
              <Select
                value={conFactura ? "con" : "sin"}
                onValueChange={(v) => setConFactura(v === "con")}
                disabled={confirmandoSF}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="con">Con factura</SelectItem>
                  <SelectItem value="sin">Sin factura (S/F)</SelectItem>
                </SelectContent>
              </Select>
              {confirmandoSF && (
                <p className="text-xs text-amber-700">
                  Pedido de productos S/F: se cobra sin factura.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(null)} disabled={loading}>
              Volver
            </Button>
            <Button onClick={onConfirmar} disabled={loading}>
              {loading ? "Cobrando…" : "Cobrar y generar factura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
