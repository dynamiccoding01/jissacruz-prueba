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
import { unidadSchema, type UnidadValues } from "@/lib/validations/unidad"
import { createUnidad, updateUnidad } from "./actions"

const VACIO: UnidadValues = { codigo: "", nombre: "", abreviatura: "" }

type UnidadExistente = {
  id: string
  codigo: string
  nombre: string
  abreviatura: string | null
}

export function UnidadForm({
  unidad,
  trigger,
}: {
  unidad?: UnidadExistente
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
  } = useForm<UnidadValues>({
    resolver: zodResolver(unidadSchema),
    defaultValues: VACIO,
  })

  useEffect(() => {
    if (!open) return
    reset(
      unidad
        ? { codigo: unidad.codigo, nombre: unidad.nombre, abreviatura: unidad.abreviatura ?? "" }
        : VACIO
    )
  }, [open, unidad, reset])

  async function onSubmit(values: UnidadValues) {
    setLoading(true)
    const result = unidad ? await updateUnidad(unidad.id, values) : await createUnidad(values)
    setLoading(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(unidad ? "Unidad actualizada." : "Unidad creada.")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{unidad ? "Editar unidad" : "Nueva unidad"}</DialogTitle>
          <DialogDescription>Ej: código PZA, nombre Pieza, abreviatura pza.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-[7rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" placeholder="PZA" {...register("codigo")} />
              {errors.codigo && <p className="text-sm text-destructive">{errors.codigo.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" placeholder="Pieza" {...register("nombre")} />
              {errors.nombre && <p className="text-sm text-destructive">{errors.nombre.message}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="abreviatura">Abreviatura (opcional)</Label>
            <Input id="abreviatura" placeholder="pza" {...register("abreviatura")} />
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
