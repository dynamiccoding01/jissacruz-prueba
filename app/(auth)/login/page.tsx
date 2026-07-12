import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-primary">SISREP</CardTitle>
          <CardDescription>JISSACRUZ — Inventario, compras y ventas</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
