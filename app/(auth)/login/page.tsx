import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { LoginForm } from "./login-form"

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex items-center gap-2 text-lg font-bold tracking-tight">
          <div className="flex size-8 items-center justify-center rounded-md bg-white/15 text-sm">
            S
          </div>
          SISREP
        </div>
        <div className="relative space-y-3">
          <h2 className="text-3xl font-bold leading-tight">
            Inventario, compras y ventas de repuestos, todo en un solo lugar.
          </h2>
          <p className="max-w-md text-sm text-primary-foreground/70">
            Sistema interno de JISSACRUZ para camiones de alto tonelaje — Santa Cruz, Bolivia.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center bg-background p-6 md:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-2xl font-bold text-foreground">Iniciar sesión</h1>
            <p className="text-sm text-muted-foreground">
              Ingresá con el correo y contraseña que te dio el administrador.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  )
}
