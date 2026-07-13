"use client"

import { useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import type { ColumnDef } from "@tanstack/react-table"
import { BarChart3, FileText, Package, TrendingUp } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TablaDatos } from "@/components/shared/tabla-datos"
import { ExportButtons } from "@/components/shared/export-buttons"
import {
  REPORTE_LABEL,
  type Fila,
  type Periodo,
  type ReporteResultado,
  type ReporteTipo,
} from "@/lib/reportes-tipos"
import { obtenerReporte } from "./actions"

// recharts es pesado y solo se usa en el gráfico: se carga diferido (solo en el
// cliente) para no inflar el bundle inicial de Reportes ni su compile en dev.
const ReporteChart = dynamic(() => import("./reporte-chart").then((m) => m.ReporteChart), {
  ssr: false,
  loading: () => <div className="h-[240px] animate-pulse rounded-md bg-muted/40" />,
})

const TIPOS: { tipo: ReporteTipo; icon: LucideIcon }[] = [
  { tipo: "ventas", icon: TrendingUp },
  { tipo: "proformas", icon: FileText },
  { tipo: "mas_vendidos", icon: BarChart3 },
  { tipo: "inventario", icon: Package },
]

function isoHoy() {
  return new Date().toISOString().slice(0, 10)
}
function isoInicioMes() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

export function ReportesExplorer({ inicial }: { inicial: ReporteResultado }) {
  const [tipo, setTipo] = useState<ReporteTipo>(inicial.tipo)
  const [desde, setDesde] = useState(isoInicioMes())
  const [hasta, setHasta] = useState(isoHoy())
  const [periodo, setPeriodo] = useState<Periodo>("diario")
  const [reporte, setReporte] = useState<ReporteResultado>(inicial)
  const [cargando, startTransition] = useTransition()

  const usaFechas = tipo !== "inventario"
  const usaPeriodo = tipo === "ventas"

  function refrescar(next: {
    tipo?: ReporteTipo
    desde?: string
    hasta?: string
    periodo?: Periodo
  }) {
    const t = next.tipo ?? tipo
    const params = {
      desde: next.desde ?? desde,
      hasta: next.hasta ?? hasta,
      periodo: next.periodo ?? periodo,
    }
    startTransition(async () => {
      const data = await obtenerReporte(t, params)
      setReporte(data)
    })
  }

  const pdfHref = useMemo(() => {
    const qs = new URLSearchParams({ tipo })
    if (usaFechas) {
      qs.set("desde", desde)
      qs.set("hasta", hasta)
    }
    if (usaPeriodo) qs.set("periodo", periodo)
    return `/api/pdf/reporte?${qs.toString()}`
  }, [tipo, desde, hasta, periodo, usaFechas, usaPeriodo])

  // Excel: usa las etiquetas de columna como encabezados.
  const excelData = useMemo(
    () =>
      reporte.filas.map((fila) =>
        Object.fromEntries(reporte.columnas.map((c) => [c.label, fila[c.key] ?? ""]))
      ),
    [reporte]
  )

  const columns: ColumnDef<Fila>[] = reporte.columnas.map((c) => {
    // El encabezado hereda la misma alineación que su columna para que el
    // título quede sobre sus valores (los numéricos van a la derecha).
    const alineado = c.align === "right" ? "text-right" : undefined
    return {
      accessorKey: c.key,
      header: () => <div className={alineado}>{c.label}</div>,
      cell: ({ row }) => (
        <div className={c.align === "right" ? "text-right tabular-nums" : undefined}>
          {String(row.original[c.key] ?? "")}
        </div>
      ),
    }
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TIPOS.map(({ tipo: t, icon: Icon }) => (
          <Button
            key={t}
            variant={t === tipo ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTipo(t)
              refrescar({ tipo: t })
            }}
          >
            <Icon className="size-4" /> {REPORTE_LABEL[t]}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            {usaFechas && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="desde">
                    Desde
                  </Label>
                  <Input
                    id="desde"
                    type="date"
                    className="w-40"
                    value={desde}
                    max={hasta}
                    onChange={(e) => {
                      setDesde(e.target.value)
                      refrescar({ desde: e.target.value })
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="hasta">
                    Hasta
                  </Label>
                  <Input
                    id="hasta"
                    type="date"
                    className="w-40"
                    value={hasta}
                    min={desde}
                    max={isoHoy()}
                    onChange={(e) => {
                      setHasta(e.target.value)
                      refrescar({ hasta: e.target.value })
                    }}
                  />
                </div>
              </>
            )}
            {usaPeriodo && (
              <div className="space-y-1">
                <Label className="text-xs">Agrupar por</Label>
                <Select
                  value={periodo}
                  onValueChange={(v) => {
                    setPeriodo(v as Periodo)
                    refrescar({ periodo: v as Periodo })
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Día</SelectItem>
                    <SelectItem value="semanal">Semana</SelectItem>
                    <SelectItem value="mensual">Mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {!usaFechas && (
              <p className="text-sm text-muted-foreground">
                Estado actual del inventario, sin filtro de fechas.
              </p>
            )}
          </div>

          <ExportButtons
            pdfHref={pdfHref}
            excelData={excelData}
            excelFilename={`reporte-${tipo}`}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-base font-semibold">{reporte.titulo}</h2>
        <p className="text-sm text-muted-foreground">{reporte.subtitulo}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {reporte.resumen.map((r, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="text-xl font-semibold text-primary">{r.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {reporte.grafico && reporte.grafico.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <ReporteChart data={reporte.grafico} esMoneda={reporte.tipo === "ventas"} />
          </CardContent>
        </Card>
      )}

      <TablaDatos
        columns={columns}
        data={reporte.filas}
        loading={cargando}
        mensajeVacio="No hay datos para el período seleccionado."
      />
    </div>
  )
}
