"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import type { OrdenFila } from "./compras-explorer"
import { recibirOrdenCompra } from "./actions"

export function OrdenDetalle({ orden, trigger }: { orden: OrdenFila; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function onRecibir() {
    setLoading(true)
    const result = await recibirOrdenCompra(orden.id)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Mercadería recibida: stock actualizado.")
    setOpen(false)
    router.refresh()
  }

  const total = orden.orden_compra_items.reduce(
    (acc, i) => acc + i.cantidad * i.costo_unitario,
    0
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Orden de compra
            <Badge variant={orden.estado === "recibida" ? "default" : "secondary"}>
              {orden.estado}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {orden.proveedores?.nombre ?? "Proveedor no disponible"} ·{" "}
            {format(new Date(orden.fecha_orden), "dd/MM/yyyy HH:mm")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {orden.orden_compra_items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span>
                {item.productos?.codigo ?? "—"} — {item.productos?.descripcion ?? ""}
              </span>
              <span className="text-muted-foreground">
                {item.cantidad} × Bs {Number(item.costo_unitario).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        <p className="text-right text-sm font-medium">Total: Bs {total.toFixed(2)}</p>

        {orden.notas && (
          <p className="text-sm text-muted-foreground">Notas: {orden.notas}</p>
        )}

        {orden.estado === "pendiente" && (
          <DialogFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={loading}>Recibir mercadería</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Confirmar recepción?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Se va a sumar el stock de cada producto y quedará registrado en el Kardex.
                    Esta acción no se puede deshacer desde la interfaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onRecibir}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
