import { requireAdmin } from "@/lib/auth/session"

export default async function ReportesPage() {
  await requireAdmin()

  return <p className="text-muted-foreground">Próximamente: reportes y exportación (Fase 9).</p>
}
