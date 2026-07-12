"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export function ReporteChart({
  data,
  esMoneda,
}: {
  data: { etiqueta: string; total: number }[]
  esMoneda: boolean
}) {
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
          formatter={(value) => [
            esMoneda ? `Bs ${Number(value).toFixed(2)}` : String(value),
            esMoneda ? "Total" : "Unidades",
          ]}
          contentStyle={{ borderRadius: 8, borderColor: "hsl(var(--border))", fontSize: 12 }}
        />
        <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
