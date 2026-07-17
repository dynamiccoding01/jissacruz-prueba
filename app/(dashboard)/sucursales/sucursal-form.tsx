"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { sucursalSchema, type SucursalValues } from "@/lib/validations/sucursal"
import { createSucursal, updateSucursal } from "./actions"

const VACIO: SucursalValues = { codigo: "", nombre: "", direccion: "", telefono: "" }

type SucursalExistente = {
  id: string
  codigo: string
  nombre: string
  direccion: string | null
  telefono: string | null
}

export function SucursalForm({
  sucursal,
  trigger,
}: {
  sucursal?: SucursalExistente
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SucursalValues>({
    resolver: zodResolver(sucursalSchema),
    defaultValues: VACIO,
  })

  useEffect(() => {
    if (!open) return
    reset(
      sucursal
        ? {
            codigo: sucursal.codigo,
            nombre: sucursal.nombre,
            direccion: sucursal.direccion ?? "",
            telefono: sucursal.telefono ?? "",
          }
        : VACIO
    )
  }, [open, sucursal, reset])

  async function onSubmit(values: SucursalValues) {
    setLoading(true)
    const result = sucursal
      ? await updateSucursal(sucursal.id, values)
      : await createSucursal(values)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(sucursal ? "Sucursal actualizada." : "Sucursal creada.")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sucursal ? "Editar sucursal" : "Nueva sucursal"}</DialogTitle>
          <DialogDescription>Datos de la sucursal o almacén.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" placeholder="1" {...register("codigo")} />
              {errors.codigo && <p className="text-sm text-destructive">{errors.codigo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" {...register("nombre")} />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" {...register("direccion")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input id="telefono" {...register("telefono")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
