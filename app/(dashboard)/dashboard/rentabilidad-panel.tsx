import { AlertTriangle, Banknote, Percent, Receipt, TrendingUp, type LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Una fila de fn_rentabilidad_por_factura (script 43): un tipo de factura.
export type RentabilidadTipo = {
  con_factura: boolean
  desde: string
  cantidad_ventas: number
  ingresos: number
  costo_ventas: number
  utilidad_bruta: number
  lineas_sin_costo: number
}

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

function Dato({
  label,
  value,
  hint,
  icon: Icon,
  alerta = false,
}: {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  alerta?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-lg font-semibold tabular-nums", alerta && "text-destructive")}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Icon className={cn("size-4 shrink-0", alerta ? "text-destructive" : "text-primary")} />
    </div>
  )
}

// T4 (PLAN_6): rentabilidad de UN tipo de factura. Los dos paneles (con y sin
// factura) van lado a lado y nunca se suman entre sí.
export function RentabilidadPanel({ datos }: { datos: RentabilidadTipo }) {
  const ingresos = Number(datos.ingresos)
  const utilidad = Number(datos.utilidad_bruta)
  const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0
  const negativa = utilidad < 0

  return (
    <Card className={cn("border-t-4", datos.con_factura ? "border-t-primary" : "border-t-amber-400")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm">
          {datos.con_factura ? "Con factura" : "Sin factura (S/F)"}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {datos.cantidad_ventas} venta{datos.cantidad_ventas === 1 ? "" : "s"}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Dato label="Ingresos por ventas" value={bs(ingresos)} hint="netos, sin impuesto" icon={Banknote} />
          <Dato
            label="Costo de ventas"
            value={bs(datos.costo_ventas)}
            hint="costo de compra (FIFO)"
            icon={Receipt}
          />
          <Dato
            label="Utilidad bruta"
            value={bs(utilidad)}
            hint="ingresos − costo"
            icon={TrendingUp}
            alerta={negativa}
          />
          <Dato
            label="Margen bruto"
            value={`${margen.toFixed(1)} %`}
            hint="utilidad sobre ingresos"
            icon={Percent}
            alerta={negativa}
          />
        </div>
        {datos.lineas_sin_costo > 0 && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {datos.lineas_sin_costo} línea(s) vendida(s) sin costo registrado: la utilidad puede
            estar sobreestimada.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
