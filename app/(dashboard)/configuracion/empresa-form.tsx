"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Building2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { empresaSchema, type EmpresaValues } from "@/lib/validations/configuracion"
import { updateEmpresa } from "./actions"

export function EmpresaForm({ empresa }: { empresa: EmpresaValues }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmpresaValues>({
    resolver: zodResolver(empresaSchema),
    defaultValues: empresa,
  })

  async function onSubmit(values: EmpresaValues) {
    setLoading(true)
    const result = await updateEmpresa(values)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Configuración guardada.")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="size-4 text-primary" /> Datos de la empresa
        </CardTitle>
        <CardDescription>
          Aparecen en los PDFs de proformas y comprobantes de venta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre / Razón social</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && (
                <p className="text-sm text-destructive">{errors.nombre.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nit">NIT</Label>
              <Input id="nit" {...register("nit")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" {...register("telefono")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" {...register("direccion")} />
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <Label htmlFor="stock_minimo_default">Stock mínimo por defecto</Label>
            <Input
              id="stock_minimo_default"
              type="number"
              min={0}
              className="w-40"
              {...register("stock_minimo_default", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              Valor sugerido al crear un producto nuevo (se puede ajustar por producto).
            </p>
            {errors.stock_minimo_default && (
              <p className="text-sm text-destructive">{errors.stock_minimo_default.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
