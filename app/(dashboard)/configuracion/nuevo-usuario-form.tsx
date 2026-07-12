"use client"

import { useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { nuevoUsuarioSchema, type NuevoUsuarioValues } from "@/lib/validations/configuracion"
import { crearUsuario } from "./actions"

const VACIO: NuevoUsuarioValues = {
  nombre_completo: "",
  email: "",
  password: "",
  rol: "vendedor",
}

export function NuevoUsuarioForm({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<NuevoUsuarioValues>({
    resolver: zodResolver(nuevoUsuarioSchema),
    defaultValues: VACIO,
  })

  const rol = watch("rol")

  async function onSubmit(values: NuevoUsuarioValues) {
    setLoading(true)
    const result = await crearUsuario(values)
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success("Usuario creado. Ya puede iniciar sesión.")
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
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Se crea la cuenta y el usuario podrá ingresar con este correo y contraseña.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre_completo">Nombre completo</Label>
            <Input id="nombre_completo" {...register("nombre_completo")} />
            {errors.nombre_completo && (
              <p className="text-sm text-destructive">{errors.nombre_completo.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="text" autoComplete="off" {...register("password")} />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={rol} onValueChange={(v) => setValue("rol", v as NuevoUsuarioValues["rol"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendedor">Vendedor</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Anotá la contraseña: se la tenés que comunicar al usuario. Podrá cambiarla luego.
          </p>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
