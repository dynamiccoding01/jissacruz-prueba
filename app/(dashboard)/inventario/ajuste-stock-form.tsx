"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ajusteStockSchema, type AjusteStockInput } from "@/lib/validations/inventario"
import { ajustarStock } from "./actions"

const VACIO: AjusteStockInput = {
  tipo: "entrada",
  cantidad: 1,
  motivo: "",
  costo_unitario: undefined,
}

export function AjusteStockForm({
  productoId,
  productoCodigo,
  trigger,
}: {
  productoId: string
  productoCodigo: string
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AjusteStockInput>({
    resolver: zodResolver(ajusteStockSchema),
    defaultValues: VACIO,
  })
  const tipo = watch("tipo")

  async function onSubmit(values: AjusteStockInput) {
    setLoading(true)
    const result = await ajustarStock(productoId, values)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Stock ajustado.")
    setOpen(false)
    reset(VACIO)
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset(VACIO)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajuste manual de stock — {productoCodigo}</DialogTitle>
          <DialogDescription>
            Queda registrado en el Kardex. El motivo es obligatorio.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de ajuste</Label>
            <RadioGroup
              value={tipo}
              onValueChange={(v) => setValue("tipo", v as "entrada" | "salida")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="entrada" id="tipo-entrada" />
                <Label htmlFor="tipo-entrada" className="font-normal">
                  Entrada
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="salida" id="tipo-salida" />
                <Label htmlFor="tipo-salida" className="font-normal">
                  Salida
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad</Label>
              <Input id="cantidad" type="number" min={1} {...register("cantidad")} />
              {errors.cantidad && (
                <p className="text-sm text-destructive">{errors.cantidad.message}</p>
              )}
            </div>
            {tipo === "entrada" && (
              <div className="space-y-2">
                <Label htmlFor="costo_unitario">Costo unitario (opcional)</Label>
                <Input id="costo_unitario" type="number" step="0.01" {...register("costo_unitario")} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo</Label>
            <Textarea id="motivo" rows={2} {...register("motivo")} />
            {errors.motivo && (
              <p className="text-sm text-destructive">{errors.motivo.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Confirmar ajuste"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
