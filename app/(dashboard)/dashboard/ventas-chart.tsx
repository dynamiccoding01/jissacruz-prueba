"use client"

import dynamic from "next/dynamic"

import type { PuntoVentasDia } from "./ventas-chart-inner"

export type { PuntoVentasDia } from "./ventas-chart-inner"

// recharts es pesado y el Dashboard es la primera pantalla del admin. Cargamos
// el gráfico diferido (solo en el cliente) para que la página pinte rápido y la
// librería se descargue recién cuando el gráfico entra en escena.
const Grafico = dynamic(() => import("./ventas-chart-inner").then((m) => m.VentasChart), {
  ssr: false,
  loading: () => <div className="h-[260px] animate-pulse rounded-md bg-muted/40" />,
})

export function VentasChart({ data }: { data: PuntoVentasDia[] }) {
  return <Grafico data={data} />
}
