import Link from "next/link"
import { eachDayOfInterval, format, isSameDay, startOfDay, subDays } from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  FileText,
  Package,
  Plus,
  ShoppingCart,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StockBadge } from "@/components/shared/stock-badge"
import { KpiCard } from "@/components/shared/kpi-card"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { VentasChart, type PuntoVentasDia } from "./ventas-chart"

export default async function DashboardPage() {
  await requireAdmin()
  const supabase = await createClient()

  const hoy = startOfDay(new Date())
  const hace7Dias = subDays(hoy, 6)

  const [
    { data: productos },
    { data: ventasRecientes },
    { count: proformasPendientes },
    { data: comprasRecientes },
  ] = await Promise.all([
    supabase
      .from("productos")
      .select("id, codigo, descripcion, stock_actual, stock_minimo")
      .eq("activo", true),
    supabase
      .from("ventas")
      .select("creado_en, total")
      .gte("creado_en", hace7Dias.toISOString()),
    supabase
      .from("vista_proformas")
      .select("id", { count: "exact", head: true })
      .eq("estado_efectivo", "vigente"),
    supabase
      .from("ordenes_compra")
      .select("id, estado, fecha_orden, proveedores(nombre)")
      .order("fecha_orden", { ascending: false })
      .limit(5),
  ])

  const productosCriticos = (productos ?? [])
    .filter((p) => p.stock_actual <= p.stock_minimo)
    .sort((a, b) => a.stock_actual - b.stock_actual)

  const ventasHoyTotal = (ventasRecientes ?? [])
    .filter((v) => isSameDay(new Date(v.creado_en), hoy))
    .reduce((acc, v) => acc + Number(v.total), 0)

  const dias = eachDayOfInterval({ start: hace7Dias, end: hoy })
  const serieVentas: PuntoVentasDia[] = dias.map((dia) => ({
    fecha: format(dia, "dd/MM"),
    total: (ventasRecientes ?? [])
      .filter((v) => isSameDay(new Date(v.creado_en), dia))
      .reduce((acc, v) => acc + Number(v.total), 0),
  }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/ventas">
              <Plus className="size-4" /> Nueva venta
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/proformas">
              <Plus className="size-4" /> Nueva proforma
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/productos">
              <Plus className="size-4" /> Nuevo producto
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas de hoy"
          value={`Bs ${ventasHoyTotal.toFixed(2)}`}
          icon={Wallet}
        />
        <KpiCard
          label="Stock bajo"
          value={String(productosCriticos.length)}
          icon={AlertTriangle}
          tono={productosCriticos.length > 0 ? "alerta" : "neutral"}
          hint="productos en o bajo el mínimo"
        />
        <KpiCard
          label="Proformas pendientes"
          value={String(proformasPendientes ?? 0)}
          icon={FileText}
          hint="vigentes, sin convertir"
        />
        <KpiCard
          label="Compras recientes"
          value={String(comprasRecientes?.length ?? 0)}
          icon={ShoppingCart}
          hint="últimas órdenes"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ventas de los últimos 7 días</CardTitle>
          </CardHeader>
          <CardContent>
            <VentasChart data={serieVentas} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Productos con stock crítico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {productosCriticos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todo el catálogo está sobre su stock mínimo.
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {productosCriticos.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.codigo}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.descripcion}</p>
                    </div>
                    <StockBadge stockActual={p.stock_actual} stockMinimo={p.stock_minimo} />
                  </div>
                ))}
              </div>
            )}
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href="/inventario">Ver todo el inventario →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Compras recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {(comprasRecientes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay órdenes de compra.</p>
          ) : (
            <div className="space-y-2">
              {(
                comprasRecientes as unknown as {
                  id: string
                  estado: string
                  fecha_orden: string
                  proveedores: { nombre: string } | null
                }[]
              ).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between border-b border-border py-2 text-sm last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Package className="size-4 text-muted-foreground" />
                    <span>{o.proveedores?.nombre ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{format(new Date(o.fecha_orden), "dd/MM/yyyy", { locale: es })}</span>
                    <span className="capitalize">{o.estado}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
