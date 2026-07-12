"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Download } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getHistorialCliente,
  type HistorialProforma,
  type HistorialVenta,
} from "./actions"

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

const ESTADO_VARIANT: Record<HistorialProforma["estado"], "default" | "secondary" | "destructive"> = {
  vigente: "secondary",
  convertida: "default",
  vencida: "destructive",
}

export function ClienteHistorial({
  cliente,
  trigger,
}: {
  cliente: { id: string; nombre: string }
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [proformas, setProformas] = useState<HistorialProforma[]>([])
  const [ventas, setVentas] = useState<HistorialVenta[]>([])

  async function onOpenChange(v: boolean) {
    setOpen(v)
    if (!v) return
    setCargando(true)
    const data = await getHistorialCliente(cliente.id)
    setProformas(data.proformas)
    setVentas(data.ventas)
    setCargando(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Historial de {cliente.nombre}</DialogTitle>
          <DialogDescription>Proformas y ventas registradas para este cliente.</DialogDescription>
        </DialogHeader>

        {cargando ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="max-h-[28rem] space-y-6 overflow-y-auto">
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ventas ({ventas.length})
              </h3>
              {ventas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin ventas registradas.</p>
              ) : (
                <div className="space-y-1.5">
                  {ventas.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{v.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(v.creado_en), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{bs(v.total)}</span>
                        <a href={`/api/pdf/venta/${v.id}`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" title="Descargar comprobante">
                            <Download className="size-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Proformas ({proformas.length})
              </h3>
              {proformas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin proformas registradas.</p>
              ) : (
                <div className="space-y-1.5">
                  {proformas.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{p.numero}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(p.creado_en), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={ESTADO_VARIANT[p.estado]} className="capitalize">
                          {p.estado}
                        </Badge>
                        <span className="font-medium">{bs(p.total)}</span>
                        <a href={`/api/pdf/proforma/${p.id}`} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="icon" title="Descargar PDF">
                            <Download className="size-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
