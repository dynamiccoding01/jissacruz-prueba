import "server-only"
import {
  endOfDay,
  format,
  parseISO,
  startOfDay,
  startOfISOWeek,
  startOfMonth,
} from "date-fns"
import { es } from "date-fns/locale"

import { createClient } from "@/lib/supabase/server"
import type { Periodo, ReporteResultado, ReporteTipo } from "@/lib/reportes-tipos"

export type { Columna, Fila, Periodo, ReporteResultado, ReporteTipo } from "@/lib/reportes-tipos"
export { REPORTE_LABEL } from "@/lib/reportes-tipos"

const bs = (n: number) => `Bs ${Number(n).toFixed(2)}`

// Normaliza el rango de fechas: si no viene, usa el mes en curso.
function rango(desde?: string, hasta?: string) {
  const finBase = hasta ? parseISO(hasta) : new Date()
  const inicioBase = desde ? parseISO(desde) : startOfMonth(finBase)
  return { desde: startOfDay(inicioBase), hasta: endOfDay(finBase) }
}

function etiquetaRango(desde: Date, hasta: Date) {
  return `${format(desde, "dd/MM/yyyy", { locale: es })} — ${format(hasta, "dd/MM/yyyy", {
    locale: es,
  })}`
}

// ---------- Ventas por período ----------
async function reporteVentas(
  desdeStr?: string,
  hastaStr?: string,
  periodo: Periodo = "diario"
): Promise<ReporteResultado> {
  const supabase = await createClient()
  const { desde, hasta } = rango(desdeStr, hastaStr)

  const { data } = await supabase
    .from("ventas")
    .select("total, creado_en")
    .gte("creado_en", desde.toISOString())
    .lte("creado_en", hasta.toISOString())
    .order("creado_en")

  const ventas = data ?? []

  // Agrupa por bucket segun el periodo elegido
  const buckets = new Map<string, { orden: number; etiqueta: string; total: number; cantidad: number }>()
  for (const v of ventas) {
    const fecha = new Date(v.creado_en)
    let clave: Date
    let etiqueta: string
    if (periodo === "mensual") {
      clave = startOfMonth(fecha)
      etiqueta = format(clave, "MMM yyyy", { locale: es })
    } else if (periodo === "semanal") {
      clave = startOfISOWeek(fecha)
      etiqueta = `Sem. ${format(clave, "dd/MM", { locale: es })}`
    } else {
      clave = startOfDay(fecha)
      etiqueta = format(clave, "dd/MM/yyyy", { locale: es })
    }
    const k = clave.toISOString()
    const prev = buckets.get(k) ?? { orden: clave.getTime(), etiqueta, total: 0, cantidad: 0 }
    prev.total += Number(v.total)
    prev.cantidad += 1
    buckets.set(k, prev)
  }

  const ordenados = Array.from(buckets.values()).sort((a, b) => a.orden - b.orden)
  const totalGeneral = ventas.reduce((acc, v) => acc + Number(v.total), 0)
  const cantidadVentas = ventas.length

  return {
    tipo: "ventas",
    titulo: "Reporte de ventas por período",
    subtitulo: `${etiquetaRango(desde, hasta)} · agrupado ${periodo}`,
    columnas: [
      { key: "periodo", label: "Período" },
      { key: "cantidad", label: "N.º ventas", align: "right" },
      { key: "total", label: "Total", align: "right" },
    ],
    filas: ordenados.map((b) => ({
      periodo: b.etiqueta,
      cantidad: b.cantidad,
      total: bs(b.total),
    })),
    resumen: [
      { label: "Ventas", value: String(cantidadVentas) },
      { label: "Total facturado", value: bs(totalGeneral) },
      {
        label: "Ticket promedio",
        value: bs(cantidadVentas ? totalGeneral / cantidadVentas : 0),
      },
    ],
    grafico: ordenados.map((b) => ({ etiqueta: b.etiqueta, total: b.total })),
  }
}

// ---------- Proformas ----------
async function reporteProformas(desdeStr?: string, hastaStr?: string): Promise<ReporteResultado> {
  const supabase = await createClient()
  const { desde, hasta } = rango(desdeStr, hastaStr)

  const { data } = await supabase
    .from("vista_proformas")
    .select("numero, creado_en, total, estado_efectivo, clientes(nombre)")
    .gte("creado_en", desde.toISOString())
    .lte("creado_en", hasta.toISOString())
    .order("creado_en", { ascending: false })

  const proformas = (data ?? []) as unknown as {
    numero: string
    creado_en: string
    total: number
    estado_efectivo: "vigente" | "convertida" | "vencida"
    clientes: { nombre: string } | null
  }[]

  const cuenta = { vigente: 0, convertida: 0, vencida: 0 }
  for (const p of proformas) cuenta[p.estado_efectivo] += 1

  const ETIQUETA_ESTADO = { vigente: "Vigente", convertida: "Convertida", vencida: "Vencida" }

  return {
    tipo: "proformas",
    titulo: "Reporte de proformas",
    subtitulo: etiquetaRango(desde, hasta),
    columnas: [
      { key: "numero", label: "Número" },
      { key: "fecha", label: "Fecha" },
      { key: "cliente", label: "Cliente" },
      { key: "estado", label: "Estado" },
      { key: "total", label: "Total", align: "right" },
    ],
    filas: proformas.map((p) => ({
      numero: p.numero,
      fecha: format(new Date(p.creado_en), "dd/MM/yyyy", { locale: es }),
      cliente: p.clientes?.nombre ?? "—",
      estado: ETIQUETA_ESTADO[p.estado_efectivo],
      total: bs(Number(p.total)),
    })),
    resumen: [
      { label: "Emitidas", value: String(proformas.length) },
      { label: "Convertidas", value: String(cuenta.convertida) },
      { label: "Vigentes", value: String(cuenta.vigente) },
      { label: "Vencidas", value: String(cuenta.vencida) },
    ],
  }
}

// ---------- Productos más vendidos ----------
async function reporteMasVendidos(desdeStr?: string, hastaStr?: string): Promise<ReporteResultado> {
  const supabase = await createClient()
  const { desde, hasta } = rango(desdeStr, hastaStr)

  const { data } = await supabase
    .from("venta_items")
    .select(
      "cantidad, subtotal_linea, productos(codigo, descripcion), ventas!inner(creado_en)"
    )
    .gte("ventas.creado_en", desde.toISOString())
    .lte("ventas.creado_en", hasta.toISOString())

  const items = (data ?? []) as unknown as {
    cantidad: number
    subtotal_linea: number
    productos: { codigo: string; descripcion: string } | null
  }[]

  const acumulado = new Map<string, { codigo: string; descripcion: string; cantidad: number; total: number }>()
  for (const it of items) {
    const codigo = it.productos?.codigo ?? "—"
    const prev =
      acumulado.get(codigo) ?? {
        codigo,
        descripcion: it.productos?.descripcion ?? "",
        cantidad: 0,
        total: 0,
      }
    prev.cantidad += Number(it.cantidad)
    prev.total += Number(it.subtotal_linea)
    acumulado.set(codigo, prev)
  }

  const ordenados = Array.from(acumulado.values()).sort((a, b) => b.cantidad - a.cantidad)
  const totalUnidades = ordenados.reduce((acc, p) => acc + p.cantidad, 0)

  return {
    tipo: "mas_vendidos",
    titulo: "Productos más vendidos",
    subtitulo: etiquetaRango(desde, hasta),
    columnas: [
      { key: "codigo", label: "Código" },
      { key: "descripcion", label: "Descripción" },
      { key: "cantidad", label: "Unidades", align: "right" },
      { key: "total", label: "Total vendido", align: "right" },
    ],
    filas: ordenados.map((p) => ({
      codigo: p.codigo,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      total: bs(p.total),
    })),
    resumen: [
      { label: "Productos distintos", value: String(ordenados.length) },
      { label: "Unidades vendidas", value: String(totalUnidades) },
      { label: "Más vendido", value: ordenados[0]?.codigo ?? "—" },
    ],
    grafico: ordenados.slice(0, 8).map((p) => ({ etiqueta: p.codigo, total: p.cantidad })),
  }
}

// ---------- Estado de inventario por línea/marca ----------
async function reporteInventario(): Promise<ReporteResultado> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("productos")
    .select("linea_marca, stock_actual, stock_minimo, precio")
    .eq("activo", true)

  const productos = data ?? []

  const acumulado = new Map<
    string,
    { linea: string; productos: number; unidades: number; valorizacion: number; bajoMinimo: number }
  >()
  for (const p of productos) {
    const linea = p.linea_marca?.trim() || "Sin línea"
    const prev =
      acumulado.get(linea) ?? { linea, productos: 0, unidades: 0, valorizacion: 0, bajoMinimo: 0 }
    prev.productos += 1
    prev.unidades += Number(p.stock_actual)
    prev.valorizacion += Number(p.stock_actual) * Number(p.precio)
    if (Number(p.stock_actual) <= Number(p.stock_minimo)) prev.bajoMinimo += 1
    acumulado.set(linea, prev)
  }

  const ordenados = Array.from(acumulado.values()).sort((a, b) => b.valorizacion - a.valorizacion)
  const valorTotal = ordenados.reduce((acc, l) => acc + l.valorizacion, 0)
  const unidadesTotal = ordenados.reduce((acc, l) => acc + l.unidades, 0)
  const bajoMinimoTotal = ordenados.reduce((acc, l) => acc + l.bajoMinimo, 0)

  return {
    tipo: "inventario",
    titulo: "Estado de inventario por línea",
    subtitulo: `Al ${format(new Date(), "dd/MM/yyyy", { locale: es })}`,
    columnas: [
      { key: "linea", label: "Línea / marca" },
      { key: "productos", label: "Productos", align: "right" },
      { key: "unidades", label: "Unidades", align: "right" },
      { key: "bajoMinimo", label: "Bajo mínimo", align: "right" },
      { key: "valorizacion", label: "Valorización", align: "right" },
    ],
    filas: ordenados.map((l) => ({
      linea: l.linea,
      productos: l.productos,
      unidades: l.unidades,
      bajoMinimo: l.bajoMinimo,
      valorizacion: bs(l.valorizacion),
    })),
    resumen: [
      { label: "Valorización total", value: bs(valorTotal) },
      { label: "Unidades en stock", value: String(unidadesTotal) },
      { label: "Productos bajo mínimo", value: String(bajoMinimoTotal) },
    ],
  }
}

// Punto de entrada único usado por page, actions y ruta PDF.
export async function generarReporte(
  tipo: ReporteTipo,
  params: { desde?: string; hasta?: string; periodo?: Periodo } = {}
): Promise<ReporteResultado> {
  switch (tipo) {
    case "proformas":
      return reporteProformas(params.desde, params.hasta)
    case "mas_vendidos":
      return reporteMasVendidos(params.desde, params.hasta)
    case "inventario":
      return reporteInventario()
    case "ventas":
    default:
      return reporteVentas(params.desde, params.hasta, params.periodo ?? "diario")
  }
}
