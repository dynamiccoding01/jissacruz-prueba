import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  Banknote,
  FileText,
  Package,
  Percent,
  Plus,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StockBadge } from "@/components/shared/stock-badge"
import { KpiCard } from "@/components/shared/kpi-card"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth/session"
import { diaBolivia, inicioDiaBolivia } from "@/lib/fechas-bolivia"
import { logError } from "@/lib/log"
import { VentasChart, type PuntoVentasDia } from "./ventas-chart"

// T3 (PLAN_6): período del cuadro de Rentabilidad (?periodo=hoy|mes|anio).
type PeriodoRentabilidad = "hoy" | "mes" | "anio"
const PERIODOS: { valor: PeriodoRentabilidad; etiqueta: string }[] = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "anio", etiqueta: "Este año" },
]

// Lo que devuelve fn_resumen_rentabilidad (script 42).
type ResumenRentabilidad = {
  desde: string
  cantidad_ventas: number
  ingresos: number
  costo_ventas: number
  utilidad_bruta: number
  lineas_sin_costo: number
}

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

function etiquetaPeriodo(periodo: PeriodoRentabilidad, desde: string) {
  // Mediodía UTC del día de inicio en Bolivia: misma fecha en cualquier huso.
  const dia = new Date(`${diaBolivia(desde)}T12:00:00Z`)
  if (periodo === "hoy") return format(dia, "EEEE dd/MM/yyyy", { locale: es })
  if (periodo === "mes") return format(dia, "MMMM yyyy", { locale: es })
  return `Año ${format(dia, "yyyy")}`
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { periodo?: string }
}) {
  await requireAdmin()
  const supabase = await createClient()

  const periodo: PeriodoRentabilidad =
    PERIODOS.find((p) => p.valor === searchParams.periodo)?.valor ?? "mes"

  // Días cortados en hora de Bolivia (el servidor en Vercel está en UTC).
  const hace7Dias = inicioDiaBolivia(6)

  const [
    { data: productos },
    { data: ventasRecientes },
    { count: proformasPendientes },
    { data: comprasRecientes },
    { data: rentabilidadData, error: rentabilidadError },
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
    supabase.rpc("fn_resumen_rentabilidad", { p_periodo: periodo }).single(),
  ])

  if (rentabilidadError) logError("dashboard.rentabilidad", rentabilidadError, { periodo })
  const rentabilidad = rentabilidadError ? null : (rentabilidadData as ResumenRentabilidad | null)
  const ingresos = Number(rentabilidad?.ingresos ?? 0)
  const utilidad = Number(rentabilidad?.utilidad_bruta ?? 0)
  const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0

  const productosCriticos = (productos ?? [])
    .filter((p) => p.stock_actual <= p.stock_minimo)
    .sort((a, b) => a.stock_actual - b.stock_actual)

  const hoyClave = diaBolivia(new Date())
  const ventasHoyTotal = (ventasRecientes ?? [])
    .filter((v) => diaBolivia(v.creado_en) === hoyClave)
    .reduce((acc, v) => acc + Number(v.total), 0)

  // Últimos 7 días de Bolivia (yyyy-MM-dd), del más viejo a hoy.
  const dias = Array.from({ length: 7 }, (_, i) => diaBolivia(inicioDiaBolivia(6 - i)))
  const serieVentas: PuntoVentasDia[] = dias.map((dia) => ({
    fecha: `${dia.slice(8, 10)}/${dia.slice(5, 7)}`,
    total: (ventasRecientes ?? [])
      .filter((v) => diaBolivia(v.creado_en) === dia)
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

      {/* T3 (PLAN_6): rentabilidad del período (ingresos vs costo de lo vendido) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Rentabilidad</h2>
            {rentabilidad && (
              <p className="text-xs capitalize text-muted-foreground">
                {etiquetaPeriodo(periodo, rentabilidad.desde)} · {rentabilidad.cantidad_ventas} venta
                {rentabilidad.cantidad_ventas === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-0.5">
            {PERIODOS.map((p) => (
              <Button
                key={p.valor}
                size="sm"
                variant={p.valor === periodo ? "default" : "ghost"}
                className="h-7 px-3"
                asChild
              >
                <Link href={`/dashboard?periodo=${p.valor}`} scroll={false}>
                  {p.etiqueta}
                </Link>
              </Button>
            ))}
          </div>
        </div>

        {rentabilidad ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Ingresos por ventas"
                value={bs(ingresos)}
                icon={Banknote}
                hint="ventas netas, sin impuesto"
              />
              <KpiCard
                label="Costo de ventas"
                value={bs(rentabilidad.costo_ventas)}
                icon={Receipt}
                hint="costo de compra (FIFO) de lo vendido"
              />
              <KpiCard
                label="Utilidad bruta"
                value={bs(utilidad)}
                icon={TrendingUp}
                tono={utilidad < 0 ? "alerta" : "neutral"}
                hint="ingresos − costo de ventas"
              />
              <KpiCard
                label="Margen bruto"
                value={`${margen.toFixed(1)} %`}
                icon={Percent}
                tono={utilidad < 0 ? "alerta" : "neutral"}
                hint="utilidad sobre ingresos"
              />
            </div>
            {rentabilidad.lineas_sin_costo > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700">
                <AlertTriangle className="size-3.5 shrink-0" />
                {rentabilidad.lineas_sin_costo} línea(s) vendida(s) sin costo registrado (stock
                cargado sin costo): la utilidad de este período puede estar sobreestimada.
              </p>
            )}
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            No se pudo calcular la rentabilidad. Verificá que el script 42_rentabilidad.sql esté
            corrido en la base.
          </p>
        )}
      </section>

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
