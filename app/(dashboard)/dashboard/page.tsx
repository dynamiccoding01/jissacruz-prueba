import { requireAdmin } from "@/lib/auth/session"

export default async function DashboardPage() {
  await requireAdmin()

  return <p className="text-muted-foreground">Próximamente: KPIs y gráficos (Fase 9).</p>
}
