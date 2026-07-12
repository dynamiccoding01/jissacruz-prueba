import { requireAdmin } from "@/lib/auth/session"

export default async function ConfiguracionPage() {
  await requireAdmin()

  return (
    <p className="text-muted-foreground">
      Próximamente: usuarios, datos de la empresa y stock mínimo por defecto (Fase 10).
    </p>
  )
}
