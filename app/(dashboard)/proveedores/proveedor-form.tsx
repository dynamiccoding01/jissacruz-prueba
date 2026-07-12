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
import { proveedorSchema, type ProveedorValues } from "@/lib/validations/proveedor"
import { createProveedor, updateProveedor } from "./actions"

const VACIO: ProveedorValues = { nombre: "", contacto: "", nit: "", direccion: "" }

type ProveedorExistente = {
  id: string
  nombre: string
  contacto: string | null
  nit: string | null
  direccion: string | null
}

export function ProveedorForm({
  proveedor,
  trigger,
}: {
  proveedor?: ProveedorExistente
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
  } = useForm<ProveedorValues>({
    resolver: zodResolver(proveedorSchema),
    defaultValues: VACIO,
  })

  useEffect(() => {
    if (!open) return
    reset(
      proveedor
        ? {
            nombre: proveedor.nombre,
            contacto: proveedor.contacto ?? "",
            nit: proveedor.nit ?? "",
            direccion: proveedor.direccion ?? "",
          }
        : VACIO
    )
  }, [open, proveedor, reset])

  async function onSubmit(values: ProveedorValues) {
    setLoading(true)
    const result = proveedor
      ? await updateProveedor(proveedor.id, values)
      : await createProveedor(values)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(proveedor ? "Proveedor actualizado." : "Proveedor creado.")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{proveedor ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>Datos de contacto del proveedor.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register("nombre")} />
            {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="contacto">Contacto</Label>
              <Input id="contacto" {...register("contacto")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nit">NIT</Label>
              <Input id="nit" {...register("nit")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input id="direccion" {...register("direccion")} />
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
