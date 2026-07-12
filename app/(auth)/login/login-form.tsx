"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signIn } from "@/lib/auth/actions"
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth"

export function LoginForm() {
  const [loading, setLoading] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginFormValues) {
    setLoading(true)
    const result = await signIn(values.email, values.password)
    setLoading(false)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  return (
    <form method="post" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="tu-correo@ejemplo.com"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Ingresar"}
      </Button>
    </form>
  )
}
