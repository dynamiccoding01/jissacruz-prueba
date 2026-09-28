"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export function ReporteChart({
  data,
  esMoneda,
  series,
}: {
  data: { etiqueta: string; total: number; total2?: number }[]
  esMoneda: boolean
  // T4 (PLAN_6): nombres de las series; con total2 se dibujan dos barras por
  // período (p. ej. con factura y sin factura), nunca sumadas.
  series?: { total: string; total2?: string }
}) {
  const nombreTotal = series?.total ?? (esMoneda ? "Total" : "Unidades")
  const dosSeries = Boolean(series?.total2)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          fontSize={11}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          fontSize={11}
          width={44}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))" }}
          formatter={(value, name) => [
            esMoneda ? `Bs ${Number(value).toFixed(2)}` : String(value),
            String(name),
          ]}
          contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))", fontSize: 12 }}
        />
        {dosSeries && <Legend wrapperStyle={{ fontSize: 12 }} />}
        <Bar dataKey="total" name={nombreTotal} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
        {dosSeries && (
          <Bar
            dataKey="total2"
            name={series?.total2}
            fill="hsl(var(--chart-2))"
            radius={[4, 4, 0, 0]}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
