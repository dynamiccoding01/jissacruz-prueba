"use client"

import { useEffect, useState } from "react"
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
import { clienteSchema, type ClienteValues } from "@/lib/validations/cliente"
import { createCliente, updateCliente } from "./actions"

const VACIO: ClienteValues = { nombre: "", ci_nit: "", telefono: "", direccion: "" }

type ClienteExistente = {
  id: string
  nombre: string
  ci_nit: string | null
  telefono: string | null
  direccion: string | null
}

export function ClienteForm({
  cliente,
  onSaved,
  trigger,
}: {
  cliente?: ClienteExistente
  onSaved?: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClienteValues>({
    resolver: zodResolver(clienteSchema),
    defaultValues: VACIO,
  })

  useEffect(() => {
    if (!open) return
    reset(
      cliente
        ? {
            nombre: cliente.nombre,
            ci_nit: cliente.ci_nit ?? "",
            telefono: cliente.telefono ?? "",
            direccion: cliente.direccion ?? "",
          }
        : VACIO
    )
  }, [open, cliente, reset])

  async function onSubmit(values: ClienteValues) {
    setLoading(true)
    const result = cliente
      ? await updateCliente(cliente.id, values)
      : await createCliente(values)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(cliente ? "Cliente actualizado." : "Cliente creado.")
    setOpen(false)
    onSaved?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>Datos del cliente para proformas y ventas.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" {...register("nombre")} />
            {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ci_nit">CI / NIT</Label>
              <Input id="ci_nit" {...register("ci_nit")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input id="telefono" {...register("telefono")} />
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
